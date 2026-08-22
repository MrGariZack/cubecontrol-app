package com.tonehub.midihost

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build

internal object IncomingShare {
  fun uriFrom(intent: Intent?): String? {
    if (intent == null) return null
    when (intent.action) {
      Intent.ACTION_VIEW,
      Intent.ACTION_EDIT,
      -> intent.data?.toString()?.let { return it }
      Intent.ACTION_SEND,
      Intent.ACTION_SEND_MULTIPLE,
      -> {
        streamUri(intent)?.toString()?.let { return it }
        if (inlineJson(intent) != null) return INLINE_JSON
      }
    }
    return intent.data?.toString()
  }

  fun inlineJson(intent: Intent?): String? {
    val text = intent?.getStringExtra(Intent.EXTRA_TEXT) ?: return null
    val trimmed = text.trimStart()
    return if (trimmed.startsWith("{") || trimmed.startsWith("[")) text else null
  }

  fun readBytes(activity: Activity, uriString: String): ByteArray {
    if (uriString == INLINE_JSON) {
      return (inlineJson(activity.intent) ?: throw IllegalStateException("empty share text"))
        .toByteArray(Charsets.UTF_8)
    }
    val uri = Uri.parse(uriString)
    if (uri.scheme == "file") {
      val path = uri.path ?: throw IllegalStateException("cannot open $uriString")
      return java.io.File(path).readBytes()
    }
    try {
      activity.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    } catch (_: Exception) {
      // Not persistable (typical for a one-shot VIEW). Read still works with the grant.
    }
    val stream =
      activity.contentResolver.openInputStream(uri)
        ?: throw IllegalStateException("cannot open $uriString")
    return stream.use { it.readBytes() }
  }

  fun readText(activity: Activity, uriString: String): String {
    return String(readBytes(activity, uriString), Charsets.UTF_8)
  }

  private fun streamUri(intent: Intent): Uri? {
    val extra =
      if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
      }
    extra?.let { return it }
    val clip = intent.clipData
    if (clip != null && clip.itemCount > 0) {
      return clip.getItemAt(0).uri
    }
    return null
  }

  const val INLINE_JSON = "inline:json"
}
