package com.tonehub.clips

import android.content.ContentValues
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.OverlaySettings
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.StaticOverlaySettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import kotlin.math.cos
import kotlin.math.sin

@UnstableApi
class ClipRendererModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var active: Transformer? = null
  private var partialFile: File? = null

  override fun definition() = ModuleDefinition {
    Name("CubeControlClipRenderer")

    AsyncFunction("setLandscape") { landscape: Boolean ->
      val activity = appContext.currentActivity ?: error("No Android activity")
      activity.requestedOrientation = if (landscape) {
        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
      } else {
        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("render") { input: String, slot: String, values: List<Double>, promise: Promise ->
      main.post {
        val context = appContext.reactContext
        if (context == null || active != null) {
          promise.reject("CLIP_BUSY", "The clip renderer is unavailable or busy.", null)
          return@post
        }
        val uri = Uri.parse(input)
        val source = uri.path?.let(::File)
        if (uri.scheme != "file" || source?.isFile != true || values.size != 9 || slot !in listOf("A", "B", "C")) {
          promise.reject("CLIP_SOURCE", "The source video or pedal snapshot is invalid.", null)
          return@post
        }
        val output = File(context.cacheDir, "CubeControl-${UUID.randomUUID()}.mp4")
        try {
          val overlay = PedalOverlay(drawPedal(slot, values))
          val effects = Effects(emptyList(), listOf(OverlayEffect(listOf(overlay))))
          val item = EditedMediaItem.Builder(MediaItem.fromUri(uri)).setEffects(effects).build()
          active = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                active = null
                partialFile = null
                promise.resolve(Uri.fromFile(output).toString())
              }

              override fun onError(composition: Composition, result: ExportResult, exception: ExportException) {
                active = null
                partialFile = null
                output.delete()
                promise.reject("CLIP_RENDER", exception.message, exception)
              }
            })
            .build()
          partialFile = output
          active?.start(item, output.absolutePath)
        } catch (error: Exception) {
          active = null
          partialFile = null
          output.delete()
          promise.reject("CLIP_RENDER", error.message, error)
        }
      }
    }

    AsyncFunction("saveToGallery") { input: String, name: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return@AsyncFunction false
      val context = appContext.reactContext ?: error("No Android context")
      val uri = Uri.parse(input)
      val source = uri.path?.let(::File) ?: error("Invalid clip path")
      check(uri.scheme == "file" && source.isFile)
      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, name)
        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/CubeControl")
        put(MediaStore.Video.Media.IS_PENDING, 1)
      }
      val destination = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
        ?: error("Could not create the gallery entry")
      try {
        val output = resolver.openOutputStream(destination) ?: error("Could not open the gallery file")
        output.use { target -> source.inputStream().use { it.copyTo(target) } }
        val done = ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }
        check(resolver.update(destination, done, null, null) == 1)
        true
      } catch (error: Exception) {
        resolver.delete(destination, null, null)
        throw error
      }
    }

    OnDestroy {
      main.post {
        active?.cancel()
        active = null
        partialFile?.delete()
        partialFile = null
      }
    }
  }
}

@UnstableApi
private class PedalOverlay(private val bitmap: Bitmap) : BitmapOverlay() {
  private var settings: OverlaySettings = StaticOverlaySettings.Builder().build()

  override fun configure(videoSize: Size) {
    val scale = minOf(videoSize.width * 0.88f / bitmap.width, videoSize.height * 0.22f / bitmap.height)
    settings = StaticOverlaySettings.Builder()
      .setOverlayFrameAnchor(0f, -1f)
      .setBackgroundFrameAnchor(0f, -0.92f)
      .setScale(scale, scale)
      .build()
  }

  override fun getBitmap(presentationTimeUs: Long): Bitmap = bitmap

  override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings = settings
}

private fun drawPedal(slot: String, values: List<Double>): Bitmap {
  val image = Bitmap.createBitmap(720, 200, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(image)
  val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  val accent = Color.rgb(46, 196, 182)
  paint.color = Color.argb(238, 17, 23, 29)
  canvas.drawRoundRect(0f, 0f, 720f, 200f, 24f, 24f, paint)
  paint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
  paint.textSize = 20f
  paint.color = Color.WHITE
  canvas.drawText("CubeControl", 23f, 32f, paint)
  paint.color = accent
  canvas.drawText(slot, 678f, 32f, paint)
  val labels = listOf("VOL", "IR", "REV", "MIX", "FB", "TIME", "MOD", "TONE", "GAIN")
  labels.forEachIndexed { index, label ->
    val x = 48f + index * 78f
    paint.color = Color.rgb(52, 62, 74)
    canvas.drawCircle(x, 95f, 25f, paint)
    val value = values[index].takeIf { it.isFinite() }?.coerceIn(0.0, 1.0) ?: 0.0
    val angle = Math.toRadians(135 + value * 270)
    paint.color = accent
    paint.strokeWidth = 4f
    canvas.drawLine(x, 95f, x + cos(angle).toFloat() * 18f, 95f + sin(angle).toFloat() * 18f, paint)
    paint.color = Color.WHITE
    paint.textAlign = Paint.Align.CENTER
    paint.textSize = 16f
    canvas.drawText(label, x, 144f, paint)
    paint.textAlign = Paint.Align.LEFT
  }
  return image
}
