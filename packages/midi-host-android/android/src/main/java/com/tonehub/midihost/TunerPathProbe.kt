package com.tonehub.midihost

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Dumps what Android actually sees: USB class/subclass (MIDI vs UAC streaming)
 * and AudioDeviceInfo inputs. Cube Baby is marketed as 48 kHz / 24-bit USB
 * sound card + MIDI; this probe tells us which half is present on the cable.
 */
internal object TunerPathProbe {
  const val CUBE_VID = 0x301a

  fun dump(context: Context): Map<String, Any?> {
    val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    val usbDevices = usb?.deviceList?.values?.map { describeUsb(usb, it) } ?: emptyList()
    val audioInputs = audio
      ?.getDevices(AudioManager.GET_DEVICES_INPUTS)
      ?.filter { it.isSource }
      ?.map { describeAudio(it) }
      ?: emptyList()

    val cubeUsb = usbDevices.filter { (it["cube"] as? Boolean) == true }
    val hasAudioStreaming = cubeUsb.any { device ->
      val ifaces = device["interfaces"] as? List<*> ?: emptyList<Any>()
      ifaces.any { iface ->
        val map = iface as? Map<*, *> ?: return@any false
        map["class"] == UsbConstants.USB_CLASS_AUDIO && map["subclass"] == 2
      }
    }
    val hasMidiStreaming = cubeUsb.any { device ->
      val ifaces = device["interfaces"] as? List<*> ?: emptyList<Any>()
      ifaces.any { iface ->
        val map = iface as? Map<*, *> ?: return@any false
        map["class"] == UsbConstants.USB_CLASS_AUDIO && map["subclass"] == 3
      }
    }
    val usbAudioInputs = audioInputs.filter { (it["kind"] as? String) == "usb" }
    val cubeNamedAudio = audioInputs.filter { labelLooksLikeCube(it["label"] as? String) }

    val verdict = when {
      cubeUsb.isEmpty() && usbAudioInputs.isEmpty() ->
        "NO_CUBE_USB — conecta OTG. Bluetooth del CUBE es playback (A2DP sink), no la guitarra."
      cubeUsb.isNotEmpty() && hasAudioStreaming && cubeNamedAudio.isNotEmpty() ->
        "USB_AUDIO_OK — Android ve la tarjeta CubeBaby. El afinador debe capturar a 48 kHz (estéreo→mono)."
      cubeUsb.isNotEmpty() && hasAudioStreaming && usbAudioInputs.isEmpty() ->
        "UAC_PRESENT_HAL_MISSING — hay Audio Streaming en USB, pero AudioFlinger no publicó input. OEM/UAC2."
      cubeUsb.isNotEmpty() && !hasAudioStreaming && hasMidiStreaming ->
        "MIDI_ONLY_USB — este cable solo enumera MIDI. Usa jack OUT + cable de grabación TRRS, o interfaz USB-C."
      cubeUsb.isNotEmpty() && !hasAudioStreaming && !hasMidiStreaming ->
        "CUBE_USB_UNKNOWN_CLASS — mira interfaces. Puede ser vendor-specific."
      usbAudioInputs.isNotEmpty() ->
        "USB_AUDIO_OTHER — hay audio USB, no necesariamente CubeBaby. Elígelo en el afinador."
      else -> "UNKNOWN"
    }

    return mapOf(
      "verdict" to verdict,
      "cubeUsbCount" to cubeUsb.size,
      "hasAudioStreaming" to hasAudioStreaming,
      "hasMidiStreaming" to hasMidiStreaming,
      "usbAudioInputCount" to usbAudioInputs.size,
      "cubeNamedAudioCount" to cubeNamedAudio.size,
      "usbDevices" to usbDevices,
      "audioInputs" to audioInputs,
    )
  }

  fun labelLooksLikeCube(label: String?): Boolean {
    if (label.isNullOrBlank()) return false
    return Regex("cube|cuvave|m-?vave|301a", RegexOption.IGNORE_CASE).containsMatchIn(label)
  }

  private fun describeUsb(usb: UsbManager, device: UsbDevice): Map<String, Any?> {
    val ifaces = (0 until device.interfaceCount).map { index ->
      val iface = device.getInterface(index)
      mapOf(
        "id" to iface.id,
        "class" to iface.interfaceClass,
        "subclass" to iface.interfaceSubclass,
        "protocol" to iface.interfaceProtocol,
        "name" to usbClassName(iface.interfaceClass, iface.interfaceSubclass),
        "endpoints" to iface.endpointCount,
      )
    }
    return mapOf(
      "deviceName" to device.deviceName,
      "product" to (device.productName?.toString() ?: ""),
      "manufacturer" to (device.manufacturerName?.toString() ?: ""),
      "vid" to device.vendorId,
      "pid" to device.productId,
      "cube" to (device.vendorId == CUBE_VID),
      "hasPermission" to usb.hasPermission(device),
      "interfaces" to ifaces,
    )
  }

  private fun describeAudio(device: AudioDeviceInfo): Map<String, Any?> {
    val rates = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      device.sampleRates.toList()
    } else {
      emptyList()
    }
    val channels = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      device.channelCounts.toList()
    } else {
      emptyList()
    }
    return mapOf(
      "id" to device.id,
      "kind" to PitchCaptureEngine.kindOf(device),
      "type" to device.type,
      "typeName" to audioTypeName(device.type),
      "label" to (device.productName?.toString()?.ifBlank { null } ?: audioTypeName(device.type)),
      "builtInMic" to (device.type == AudioDeviceInfo.TYPE_BUILTIN_MIC),
      "sampleRates" to rates,
      "channelCounts" to channels,
      "address" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) device.address else "",
    )
  }

  fun usbClassName(cls: Int, subclass: Int): String {
    if (cls == UsbConstants.USB_CLASS_AUDIO) {
      return when (subclass) {
        1 -> "AUDIO_CONTROL"
        2 -> "AUDIO_STREAMING"
        3 -> "MIDI_STREAMING"
        else -> "AUDIO_SUBCLASS_$subclass"
      }
    }
    return when (cls) {
      UsbConstants.USB_CLASS_HID -> "HID"
      UsbConstants.USB_CLASS_VENDOR_SPEC -> "VENDOR"
      2 -> "CDC"
      else -> "CLASS_$cls"
    }
  }

  fun audioTypeName(type: Int): String = when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_MIC -> "BUILTIN_MIC"
    AudioDeviceInfo.TYPE_USB_DEVICE -> "USB_DEVICE"
    AudioDeviceInfo.TYPE_USB_HEADSET -> "USB_HEADSET"
    AudioDeviceInfo.TYPE_USB_ACCESSORY -> "USB_ACCESSORY"
    AudioDeviceInfo.TYPE_WIRED_HEADSET -> "WIRED_HEADSET"
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "WIRED_HEADPHONES"
    AudioDeviceInfo.TYPE_LINE_ANALOG -> "LINE_ANALOG"
    AudioDeviceInfo.TYPE_LINE_DIGITAL -> "LINE_DIGITAL"
    AudioDeviceInfo.TYPE_AUX_LINE -> "AUX_LINE"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "BT_SCO"
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "BT_A2DP"
    AudioDeviceInfo.TYPE_HDMI -> "HDMI"
    else -> "TYPE_$type"
  }
}
