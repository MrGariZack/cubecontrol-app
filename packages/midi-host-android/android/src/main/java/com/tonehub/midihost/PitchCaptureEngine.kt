package com.tonehub.midihost

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Process
import kotlin.math.max

/**
 * Pitch capture from whatever Android exposes as an *audio* input.
 *
 * Cube Baby USB is a composite device in the manual (MIDI editor + 48 kHz /
 * 24-bit sound card). Guitar audio never rides MIDI SysEx. If UAC streaming
 * is present, this engine must open it at 48 kHz, often stereo, then downmix.
 */
internal class PitchCaptureEngine(
  private val context: Context,
  private val emit: (name: String, payload: Map<String, Any?>) -> Unit,
) {
  @Volatile private var running = false
  private var thread: Thread? = null

  fun listInputs(): List<Map<String, Any?>> {
    val manager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return emptyList()
    return manager.getDevices(AudioManager.GET_DEVICES_INPUTS)
      .filter { it.isSource }
      .sortedBy { rank(it) }
      .map { describe(it) }
  }

  fun probe(): Map<String, Any?> = TunerPathProbe.dump(context)

  fun start(sampleRate: Int = SAMPLE_RATE, frameSize: Int = FRAME_SIZE, preferredId: Int? = null) {
    stop()
    val chosen = resolveDevice(preferredId)
    val opened = buildRecord(sampleRate, frameSize, chosen)
      ?: throw IllegalStateException("AudioRecord no inicializado")

    emit(
      "onPitchSource",
      mapOf(
        "kind" to kindOf(chosen),
        "label" to (chosen?.productName?.toString()?.ifBlank { null } ?: kindOf(chosen)),
        "builtInMic" to (chosen == null || chosen.type == AudioDeviceInfo.TYPE_BUILTIN_MIC),
        "sampleRate" to opened.sampleRate,
        "channels" to opened.channelCount,
        "audioSource" to opened.sourceName,
        "deviceId" to (chosen?.id ?: -1),
        "deviceType" to TunerPathProbe.audioTypeName(chosen?.type ?: -1),
        "tried" to opened.tried,
      ),
    )

    running = true
    thread = Thread {
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
      val record = opened.record
      try {
        record.startRecording()
        val shorts = ShortArray(frameSize * opened.channelCount)
        while (running) {
          val n = record.read(shorts, 0, shorts.size)
          if (n < shorts.size) continue
          val samples = ArrayList<Double>(frameSize)
          if (opened.channelCount == 2) {
            for (i in 0 until frameSize) {
              val left = shorts[i * 2].toInt()
              val right = shorts[i * 2 + 1].toInt()
              samples.add((left + right) / 2.0 / 32768.0)
            }
          } else {
            for (i in 0 until frameSize) {
              samples.add(shorts[i].toDouble() / 32768.0)
            }
          }
          emit(
            "onPcmFrames",
            mapOf(
              "sampleRate" to opened.sampleRate,
              "samples" to samples,
            ),
          )
        }
      } finally {
        try {
          record.stop()
        } catch (_: Exception) {
        }
        record.release()
      }
    }.also { it.start() }
  }

  fun stop() {
    running = false
    thread?.join(400)
    thread = null
  }

  private fun resolveDevice(preferredId: Int?): AudioDeviceInfo? {
    val manager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return null
    val inputs = manager.getDevices(AudioManager.GET_DEVICES_INPUTS).filter { it.isSource }
    if (preferredId != null && preferredId >= 0) {
      inputs.find { it.id == preferredId }?.let { return it }
    }
    return inputs.minByOrNull { rank(it) }
  }

  private fun buildRecord(
    fallbackRate: Int,
    frameSize: Int,
    device: AudioDeviceInfo?,
  ): OpenedRecord? {
    val usbLike = device != null && kindOf(device) == "usb"
    val rates = if (usbLike) {
      intArrayOf(48000, 44100, 32000, fallbackRate, 16000)
    } else {
      intArrayOf(fallbackRate, 44100, 48000)
    }
    val channels = intArrayOf(
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.CHANNEL_IN_STEREO,
    )
    val sources = intArrayOf(
      MediaRecorder.AudioSource.UNPROCESSED,
      MediaRecorder.AudioSource.CAMCORDER,
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      MediaRecorder.AudioSource.DEFAULT,
      MediaRecorder.AudioSource.MIC,
    )
    val tried = ArrayList<String>()
    for (rate in rates) {
      for (channel in channels) {
        val channelCount = if (channel == AudioFormat.CHANNEL_IN_STEREO) 2 else 1
        val encoding = AudioFormat.ENCODING_PCM_16BIT
        val minBuf = AudioRecord.getMinBufferSize(rate, channel, encoding)
        if (minBuf <= 0) {
          tried.add("${rate}Hz/${channelCount}ch:minBuf=$minBuf")
          continue
        }
        val bufferSize = max(minBuf, frameSize * channelCount * 2)
        val format = AudioFormat.Builder()
          .setEncoding(encoding)
          .setSampleRate(rate)
          .setChannelMask(channel)
          .build()
        for (source in sources) {
          val sourceName = sourceName(source)
          try {
            val builder = AudioRecord.Builder()
              .setAudioSource(source)
              .setAudioFormat(format)
              .setBufferSizeInBytes(bufferSize)
            val record = builder.build()
            if (device != null) {
              record.preferredDevice = device
            }
            if (record.state == AudioRecord.STATE_INITIALIZED) {
              val routed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                record.routedDevice?.id ?: -1
              } else {
                -1
              }
              return OpenedRecord(
                record = record,
                sampleRate = rate,
                channelCount = channelCount,
                sourceName = sourceName,
                tried = tried.joinToString(" | ").ifBlank { "ok first try" } +
                  " → $rate Hz ${channelCount}ch $sourceName routed=$routed",
              )
            }
            tried.add("${rate}Hz/${channelCount}ch/$sourceName:state=${record.state}")
            record.release()
          } catch (error: Exception) {
            tried.add("${rate}Hz/${channelCount}ch/$sourceName:${error.javaClass.simpleName}")
          }
        }
      }
    }
    return null
  }

  private data class OpenedRecord(
    val record: AudioRecord,
    val sampleRate: Int,
    val channelCount: Int,
    val sourceName: String,
    val tried: String,
  )

  companion object {
    const val SAMPLE_RATE = 22050
    const val FRAME_SIZE = 2048

    fun rank(device: AudioDeviceInfo): Int {
      val cubeBoost = if (TunerPathProbe.labelLooksLikeCube(device.productName?.toString())) -20 else 0
      return cubeBoost + when (device.type) {
        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_ACCESSORY,
        -> 0
        AudioDeviceInfo.TYPE_LINE_ANALOG,
        AudioDeviceInfo.TYPE_LINE_DIGITAL,
        -> 1
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        -> 2
        AudioDeviceInfo.TYPE_HDMI,
        AudioDeviceInfo.TYPE_AUX_LINE,
        -> 3
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> 90
        else -> 50
      }
    }

    fun kindOf(device: AudioDeviceInfo?): String {
      if (device == null) return "mic"
      return when (device.type) {
        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_ACCESSORY,
        -> "usb"
        AudioDeviceInfo.TYPE_LINE_ANALOG,
        AudioDeviceInfo.TYPE_LINE_DIGITAL,
        AudioDeviceInfo.TYPE_AUX_LINE,
        -> "line"
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        -> "headset"
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "mic"
        else -> "other"
      }
    }

    fun describe(device: AudioDeviceInfo): Map<String, Any?> = mapOf(
      "id" to device.id,
      "kind" to kindOf(device),
      "label" to (device.productName?.toString()?.ifBlank { null } ?: kindOf(device)),
      "builtInMic" to (device.type == AudioDeviceInfo.TYPE_BUILTIN_MIC),
    )

    fun sourceName(source: Int): String = when (source) {
      MediaRecorder.AudioSource.UNPROCESSED -> "UNPROCESSED"
      MediaRecorder.AudioSource.CAMCORDER -> "CAMCORDER"
      MediaRecorder.AudioSource.VOICE_RECOGNITION -> "VOICE_RECOGNITION"
      MediaRecorder.AudioSource.DEFAULT -> "DEFAULT"
      MediaRecorder.AudioSource.MIC -> "MIC"
      else -> "SRC_$source"
    }
  }
}
