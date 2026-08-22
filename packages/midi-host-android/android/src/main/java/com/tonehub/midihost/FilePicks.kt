package com.tonehub.midihost

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.Promise
import java.io.File

internal object FilePicks {
  const val REQUEST_CODE = 0x70C3

  fun start(activity: Activity, mimeTypes: List<String>) {
    val types = mimeTypes.ifEmpty { listOf("*/*") }
    val intent =
      Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = if (types.size == 1) types[0] else "*/*"
        if (types.size > 1) {
          putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
        }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    activity.startActivityForResult(Intent.createChooser(intent, "CubeControl"), REQUEST_CODE)
  }

  fun finish(activity: Activity, resultCode: Int, data: Intent?, promise: Promise) {
    if (resultCode != Activity.RESULT_OK) {
      promise.resolve(null)
      return
    }
    val uri = data?.data
    if (uri == null) {
      promise.resolve(null)
      return
    }
    try {
      activity.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    } catch (_: Exception) {
    }
    val name = displayName(activity, uri) ?: "file"
    val destDir = File(activity.cacheDir, "picks").apply { mkdirs() }
    val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "-").ifBlank { "file" }
    val dest = File(destDir, "${System.currentTimeMillis()}-$safe")
    activity.contentResolver.openInputStream(uri)?.use { input ->
      dest.outputStream().use { input.copyTo(it) }
    } ?: throw IllegalStateException("cannot open $uri")
    promise.resolve(
      mapOf(
        "uri" to Uri.fromFile(dest).toString(),
        "name" to name,
      ),
    )
  }

  fun writeBytes(activity: Activity, fileName: String, bytes: ByteArray): String {
    val dir = File(activity.filesDir, "cubecontrol-ir").apply { mkdirs() }
    val safe =
      fileName.replace(Regex("[^A-Za-z0-9._-]"), "-").ifBlank { "ir.wav" }.let { name ->
        if (name.endsWith(".wav", ignoreCase = true)) name else "$name.wav"
      }
    val out = File(dir, "${System.currentTimeMillis()}-$safe")
    out.writeBytes(bytes)
    return Uri.fromFile(out).toString()
  }

  private fun displayName(activity: Activity, uri: Uri): String? {
    activity.contentResolver
      .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
      ?.use { cursor ->
        if (cursor.moveToFirst()) {
          val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (index >= 0) return cursor.getString(index)
        }
      }
    return uri.lastPathSegment
  }
}
