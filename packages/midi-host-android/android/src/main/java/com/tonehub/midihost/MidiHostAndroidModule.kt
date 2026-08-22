package com.tonehub.midihost

import android.Manifest
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MidiHostAndroidModule : Module() {
  private var engine: CubeBabyMidiEngine? = null
  private var pitch: PitchCaptureEngine? = null
  private var pickPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("MidiHostAndroid")

    Events(
      "onMidiBytes",
      "onPortsChanged",
      "onDeviceDetached",
      "onPcmFrames",
      "onPitchSource",
      "onIncomingShare",
    )

    AsyncFunction("probeTunerPath") {
      pitchInputs().probe()
    }

    OnDestroy {
      pitch?.stop()
      pitch = null
      engine?.stop()
      engine = null
    }

    Function("isAvailable") {
      ensureEngine().isAvailable()
    }

    Function("isPitchCaptureAvailable") {
      true
    }

    AsyncFunction("listPorts") {
      ensureEngine().listPorts()
    }

    AsyncFunction("requestUsbAccess") { promise: Promise ->
      ensureEngine().requestUsbAccess(promise)
    }

    AsyncFunction("openInput") { portId: String, promise: Promise ->
      ensureEngine().openInput(portId, promise)
    }

    AsyncFunction("closeInput") { portId: String ->
      ensureEngine().closeInput(portId)
    }

    AsyncFunction("openOutput") { portId: String, promise: Promise ->
      ensureEngine().openOutput(portId, promise)
    }

    AsyncFunction("send") { portId: String, data: ByteArray ->
      ensureEngine().send(portId, data)
    }

    AsyncFunction("closeOutput") { portId: String ->
      ensureEngine().closeOutput(portId)
    }

    AsyncFunction("closeAll") {
      ensureEngine().closeAll()
    }

    AsyncFunction("listPitchInputs") {
      pitchInputs().listInputs()
    }

    AsyncFunction("requestMicPermission") { promise: Promise ->
      val manager = appContext.permissions ?: throw Exceptions.ReactContextLost()
      Permissions.askForPermissionsWithPermissionsManager(
        manager,
        promise,
        Manifest.permission.RECORD_AUDIO,
      )
    }

    AsyncFunction("startPitchCapture") { deviceId: Int ->
      pitch?.stop()
      val created = PitchCaptureEngine(requireContext()) { name, payload -> sendEvent(name, payload) }
      val id = if (deviceId < 0) null else deviceId
      created.start(preferredId = id)
      pitch = created
    }

    AsyncFunction("stopPitchCapture") {
      pitch?.stop()
      pitch = null
    }

    OnNewIntent { intent ->
      val uri = IncomingShare.uriFrom(intent)
      if (uri != null) {
        sendEvent("onIncomingShare", mapOf("uri" to uri))
      }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode != FilePicks.REQUEST_CODE) return@OnActivityResult
      val promise = pickPromise
      pickPromise = null
      if (promise == null) return@OnActivityResult
      try {
        FilePicks.finish(activity, payload.resultCode, payload.data, promise)
      } catch (err: Exception) {
        promise.reject("PICK_FILE", err.message, err)
      }
    }

    AsyncFunction("pickFile") { mimeTypes: List<String>, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      pickPromise?.resolve(null)
      pickPromise = promise
      FilePicks.start(activity, mimeTypes)
    }

    AsyncFunction("writeBytesFile") { fileName: String, bytes: ByteArray ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      FilePicks.writeBytes(activity, fileName, bytes)
    }

    AsyncFunction("getIncomingShareUri") {
      IncomingShare.uriFrom(appContext.currentActivity?.intent)
    }

    AsyncFunction("readTextUri") { uriString: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      IncomingShare.readText(activity, uriString)
    }

    AsyncFunction("readBytesUri") { uriString: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      IncomingShare.readBytes(activity, uriString)
    }

    AsyncFunction("shareJson") { fileName: String, json: String ->
      val activity =
        appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val dir = java.io.File(activity.cacheDir, "share").apply { mkdirs() }
      val safe =
        fileName.replace(Regex("[^A-Za-z0-9._-]"), "-").ifBlank { "cubecontrol" }
      val out = java.io.File(dir, if (safe.endsWith(".json")) safe else "$safe.json")
      out.writeText(json)
      val uri =
        androidx.core.content.FileProvider.getUriForFile(
          activity,
          "${activity.packageName}.cubecontrol.share",
          out,
        )
      val send =
        android.content.Intent(android.content.Intent.ACTION_SEND).apply {
          type = "text/plain"
          putExtra(android.content.Intent.EXTRA_SUBJECT, fileName)
          putExtra(android.content.Intent.EXTRA_TEXT, json)
          putExtra(android.content.Intent.EXTRA_STREAM, uri)
          clipData = android.content.ClipData.newRawUri(fileName, uri)
          addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      val chooser = android.content.Intent.createChooser(send, fileName).apply {
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val matches =
        activity.packageManager.queryIntentActivities(
          chooser,
          android.content.pm.PackageManager.MATCH_DEFAULT_ONLY,
        )
      for (resolve in matches) {
        activity.grantUriPermission(
          resolve.activityInfo.packageName,
          uri,
          android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,
        )
      }
      activity.startActivity(chooser)
    }
  }

  private fun requireContext(): android.content.Context {
    return appContext.reactContext ?: throw Exceptions.ReactContextLost()
  }

  private fun pitchInputs(): PitchCaptureEngine {
    return PitchCaptureEngine(requireContext()) { _, _ -> }
  }

  private fun ensureEngine(): CubeBabyMidiEngine {
    engine?.let { return it }
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val created = CubeBabyMidiEngine(context) { name, payload -> sendEvent(name, payload) }
    created.start()
    engine = created
    return created
  }
}
