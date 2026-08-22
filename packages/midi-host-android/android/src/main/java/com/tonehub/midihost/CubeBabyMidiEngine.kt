package com.tonehub.midihost

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiInputPort
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import java.io.IOException

/**
 * USB-MIDI 1.0 host for CUBE Baby (VID 0x301A / PID 0x5555).
 *
 * Android names ports from the *device* side:
 * - MidiOutputPort = bytes FROM the pedal → NativeMidiHost **input**
 * - MidiInputPort  = bytes TO the pedal   → NativeMidiHost **output**
 *
 * Chunks from [MidiReceiver.onSend] are forwarded raw (no SysEx assembly).
 */
internal class CubeBabyMidiEngine(
  private val context: Context,
  private val emit: (name: String, payload: Map<String, Any?>) -> Unit,
) {
  private val handler = Handler(Looper.getMainLooper())
  private val lock = Any()

  private var midiManager: MidiManager? = null
  private var usbManager: UsbManager? = null
  private var started = false

  private val openedDevices = mutableMapOf<Int, MidiDevice>()
  private val inputPorts = mutableMapOf<String, MidiOutputPort>()
  private val outputPorts = mutableMapOf<String, MidiInputPort>()
  private val receivers = mutableMapOf<String, MidiReceiver>()

  private var permissionPromise: Promise? = null

  private val deviceCallback = object : MidiManager.DeviceCallback() {
    override fun onDeviceAdded(device: MidiDeviceInfo) {
      emit("onPortsChanged", emptyMap())
    }

    override fun onDeviceRemoved(device: MidiDeviceInfo) {
      val detachedIds = synchronized(lock) {
        val ids =
          inputPorts.keys.filter { parsePortId(it)?.deviceId == device.id } +
            outputPorts.keys.filter { parsePortId(it)?.deviceId == device.id }
        closeDeviceLocked(device.id)
        ids
      }
      emit(
        "onDeviceDetached",
        mapOf(
          "deviceId" to device.id,
          "portIds" to detachedIds,
        ),
      )
      emit("onPortsChanged", emptyMap())
    }
  }

  private val usbReceiver = object : BroadcastReceiver() {
    override fun onReceive(ctx: Context?, intent: Intent?) {
      when (intent?.action) {
        ACTION_USB_PERMISSION -> {
          val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
          val pending = permissionPromise
          permissionPromise = null
          pending?.resolve(
            mapOf(
              "found" to true,
              "granted" to granted,
            ),
          )
        }
        UsbManager.ACTION_USB_DEVICE_DETACHED -> {
          val device = usbDeviceExtra(intent) ?: return
          if (!isCubeBabyUsb(device)) return
          emit(
            "onDeviceDetached",
            mapOf(
              "deviceId" to device.deviceId,
              "portIds" to emptyList<String>(),
            ),
          )
          emit("onPortsChanged", emptyMap())
        }
      }
    }
  }

  fun start() {
    if (started) return
    started = true
    midiManager = context.getSystemService(Context.MIDI_SERVICE) as? MidiManager
    usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
    midiManager?.registerDeviceCallback(deviceCallback, handler)

    val filter = IntentFilter().apply {
      addAction(ACTION_USB_PERMISSION)
      addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      context.registerReceiver(usbReceiver, filter)
    }
  }

  fun stop() {
    if (!started) return
    started = false
    runCatching { context.unregisterReceiver(usbReceiver) }
    midiManager?.unregisterDeviceCallback(deviceCallback)
    closeAll()
    midiManager = null
    usbManager = null
  }

  fun isAvailable(): Boolean {
    return try {
      requireMidi()
      true
    } catch (_: Exception) {
      false
    }
  }

  fun listPorts(): List<Map<String, Any?>> {
    val manager = requireMidi()
    return listDeviceInfo(manager).flatMap { info -> toNativePorts(info) }
  }

  fun requestUsbAccess(promise: Promise) {
    val usb = usbManager
    if (usb == null) {
      promise.resolve(mapOf("found" to false, "granted" to false))
      return
    }

    val cube = findCubeUsbDevices(usb)
    if (cube.isEmpty()) {
      promise.resolve(mapOf("found" to false, "granted" to false))
      return
    }

    val needsPermission = cube.filter { !usb.hasPermission(it) }
    if (needsPermission.isEmpty()) {
      promise.resolve(mapOf("found" to true, "granted" to true))
      return
    }

    permissionPromise?.resolve(mapOf("found" to true, "granted" to false))
    permissionPromise = promise

    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val intent = Intent(ACTION_USB_PERMISSION).apply { setPackage(context.packageName) }
    val pending = PendingIntent.getBroadcast(context, 0, intent, flags)
    usb.requestPermission(needsPermission.first(), pending)

    handler.postDelayed({
      val pendingPromise = permissionPromise ?: return@postDelayed
      permissionPromise = null
      pendingPromise.resolve(mapOf("found" to true, "granted" to false))
    }, USB_PERMISSION_TIMEOUT_MS)
  }

  fun openInput(portId: String, promise: Promise) {
    val parsed = parsePortId(portId)
    if (parsed == null || parsed.direction != "input") {
      promise.reject("ERR_PORT_NOT_FOUND", "Puerto MIDI de entrada no válido: $portId", null)
      return
    }
    openDevice(parsed.deviceId) { device ->
      if (device == null) {
        promise.reject(
          "ERR_DEVICE_OPEN",
          "No se pudo abrir el CUBE Baby. Usa un cable OTG con datos (no solo carga), acepta el permiso USB y cierra CubeSuite.",
          null,
        )
        return@openDevice
      }
      try {
        synchronized(lock) {
          if (!inputPorts.containsKey(portId)) {
            val outputPort = device.openOutputPort(parsed.portNumber)
              ?: throw IOException("openOutputPort(${parsed.portNumber}) devolvió null")
            val receiver = ChunkReceiver(portId)
            outputPort.connect(receiver)
            inputPorts[portId] = outputPort
            receivers[portId] = receiver
          }
        }
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(
          "ERR_DEVICE_OPEN",
          error.message
            ?: "No se pudo abrir el puerto MIDI de entrada. Cierra CubeSuite u otra app MIDI.",
          error,
        )
      }
    }
  }

  fun closeInput(portId: String) {
    synchronized(lock) {
      receivers.remove(portId)?.let { receiver ->
        runCatching { inputPorts[portId]?.disconnect(receiver) }
      }
      runCatching { inputPorts.remove(portId)?.close() }
      maybeCloseDeviceLocked(parsePortId(portId)?.deviceId)
    }
  }

  fun openOutput(portId: String, promise: Promise) {
    val parsed = parsePortId(portId)
    if (parsed == null || parsed.direction != "output") {
      promise.reject("ERR_PORT_NOT_FOUND", "Puerto MIDI de salida no válido: $portId", null)
      return
    }
    openDevice(parsed.deviceId) { device ->
      if (device == null) {
        promise.reject(
          "ERR_DEVICE_OPEN",
          "No se pudo abrir el CUBE Baby. Usa un cable OTG con datos (no solo carga), acepta el permiso USB y cierra CubeSuite.",
          null,
        )
        return@openDevice
      }
      try {
        synchronized(lock) {
          if (!outputPorts.containsKey(portId)) {
            val inputPort = device.openInputPort(parsed.portNumber)
              ?: throw IOException("openInputPort(${parsed.portNumber}) devolvió null")
            outputPorts[portId] = inputPort
          }
        }
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(
          "ERR_DEVICE_OPEN",
          error.message
            ?: "No se pudo abrir el puerto MIDI de salida. Cierra CubeSuite u otra app MIDI.",
          error,
        )
      }
    }
  }

  fun send(portId: String, data: ByteArray) {
    val port = synchronized(lock) { outputPorts[portId] }
      ?: throw IOException(
        "El CUBE Baby se desconectó. Revisa el cable OTG de datos y vuelve a conectar.",
      )
    try {
      port.send(data, 0, data.size)
    } catch (error: IOException) {
      throw IOException(
        "El CUBE Baby se desconectó. Revisa el cable OTG de datos y vuelve a conectar.",
        error,
      )
    }
  }

  fun closeOutput(portId: String) {
    synchronized(lock) {
      runCatching { outputPorts.remove(portId)?.close() }
      maybeCloseDeviceLocked(parsePortId(portId)?.deviceId)
    }
  }

  fun closeAll() {
    synchronized(lock) {
      receivers.keys.toList().forEach { portId ->
        receivers.remove(portId)?.let { receiver ->
          runCatching { inputPorts[portId]?.disconnect(receiver) }
        }
      }
      inputPorts.values.forEach { runCatching { it.close() } }
      outputPorts.values.forEach { runCatching { it.close() } }
      openedDevices.values.forEach { runCatching { it.close() } }
      receivers.clear()
      inputPorts.clear()
      outputPorts.clear()
      openedDevices.clear()
    }
  }

  private fun requireMidi(): MidiManager {
    val existing = midiManager
    if (existing != null) return existing
    val created = context.getSystemService(Context.MIDI_SERVICE) as? MidiManager
      ?: throw IllegalStateException(
        "Este Android no expone MidiManager. CubeControl USB-OTG necesita un development build (no Expo Go) y android.software.midi.",
      )
    midiManager = created
    return created
  }

  private fun listDeviceInfo(manager: MidiManager): Array<MidiDeviceInfo> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      manager.getDevicesForTransport(MidiManager.TRANSPORT_MIDI_BYTE_STREAM).toTypedArray()
    } else {
      @Suppress("DEPRECATION")
      manager.devices
    }
  }

  private fun toNativePorts(info: MidiDeviceInfo): List<Map<String, Any?>> {
    if (info.type == MidiDeviceInfo.TYPE_BLUETOOTH) return emptyList()

    val usb = usbDeviceOf(info)
    val vendorId = usb?.vendorId
    val productId = usb?.productId
    val name = info.properties.getString(MidiDeviceInfo.PROPERTY_NAME)
      ?: info.properties.getString(MidiDeviceInfo.PROPERTY_PRODUCT)
      ?: "USB-MIDI ${info.id}"
    if (info.type == MidiDeviceInfo.TYPE_VIRTUAL) {
      val looksLikeCube = Regex("""cube[\s-]*baby""", RegexOption.IGNORE_CASE).containsMatchIn(name)
      if (!looksLikeCube) return emptyList()
    }
    val manufacturer = info.properties.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER)

    return info.ports.mapNotNull { port ->
      val direction = when (port.type) {
        MidiDeviceInfo.PortInfo.TYPE_OUTPUT -> "input"
        MidiDeviceInfo.PortInfo.TYPE_INPUT -> "output"
        else -> return@mapNotNull null
      }
      val id = "android:${info.id}:$direction:${port.portNumber}"
      buildMap {
        put("id", id)
        put("direction", direction)
        put("name", port.name?.takeIf { it.isNotBlank() } ?: name)
        manufacturer?.let { put("manufacturer", it) }
        vendorId?.let { put("vendorId", it) }
        productId?.let { put("productId", it) }
        put("state", "connected")
        put("deviceId", info.id)
        put("androidPortNumber", port.portNumber)
      }
    }
  }

  private fun openDevice(deviceId: Int, callback: (MidiDevice?) -> Unit) {
    synchronized(lock) {
      openedDevices[deviceId]?.let {
        callback(it)
        return
      }
    }
    val manager = requireMidi()
    val info = listDeviceInfo(manager).find { it.id == deviceId }
    if (info == null) {
      callback(null)
      return
    }
    manager.openDevice(info, { device ->
      if (device != null) {
        synchronized(lock) { openedDevices[deviceId] = device }
      }
      callback(device)
    }, handler)
  }

  private fun closeDeviceLocked(deviceId: Int) {
    val toCloseInputs = inputPorts.keys.filter { parsePortId(it)?.deviceId == deviceId }
    val toCloseOutputs = outputPorts.keys.filter { parsePortId(it)?.deviceId == deviceId }
    toCloseInputs.forEach { portId ->
      receivers.remove(portId)?.let { receiver ->
        runCatching { inputPorts[portId]?.disconnect(receiver) }
      }
      runCatching { inputPorts.remove(portId)?.close() }
    }
    toCloseOutputs.forEach { portId ->
      runCatching { outputPorts.remove(portId)?.close() }
    }
    runCatching { openedDevices.remove(deviceId)?.close() }
  }

  private fun maybeCloseDeviceLocked(deviceId: Int?) {
    if (deviceId == null) return
    val stillUsed = inputPorts.keys.any { parsePortId(it)?.deviceId == deviceId } ||
      outputPorts.keys.any { parsePortId(it)?.deviceId == deviceId }
    if (!stillUsed) {
      runCatching { openedDevices.remove(deviceId)?.close() }
    }
  }

  private inner class ChunkReceiver(private val portId: String) : MidiReceiver() {
    override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
      val copy = msg.copyOfRange(offset, offset + count)
      val receivedAtMs = System.currentTimeMillis().toDouble()
      handler.post {
        emit(
          "onMidiBytes",
          mapOf(
            "portId" to portId,
            "data" to copy.map { it.toInt() and 0xFF },
            "receivedAtMs" to receivedAtMs,
          ),
        )
      }
    }
  }

  companion object {
    const val ACTION_USB_PERMISSION = "com.tonehub.midihost.USB_PERMISSION"
    const val CUBE_BABY_VENDOR_ID = 0x301a
    const val CUBE_BABY_PRODUCT_ID = 0x5555
    const val USB_PERMISSION_TIMEOUT_MS = 25_000L

    data class ParsedPort(val deviceId: Int, val direction: String, val portNumber: Int)

    fun parsePortId(portId: String): ParsedPort? {
      val parts = portId.split(":")
      if (parts.size != 4 || parts[0] != "android") return null
      val deviceId = parts[1].toIntOrNull() ?: return null
      val direction = parts[2]
      if (direction != "input" && direction != "output") return null
      val portNumber = parts[3].toIntOrNull() ?: return null
      return ParsedPort(deviceId, direction, portNumber)
    }

    fun isCubeBabyUsb(device: UsbDevice): Boolean {
      return device.vendorId == CUBE_BABY_VENDOR_ID
    }

    fun findCubeUsbDevices(usb: UsbManager): List<UsbDevice> {
      val all = usb.deviceList.values.filter { it.vendorId == CUBE_BABY_VENDOR_ID }
      val exact = all.filter { it.productId == CUBE_BABY_PRODUCT_ID }
      return if (exact.isNotEmpty()) exact else all.toList()
    }

    fun usbDeviceOf(info: MidiDeviceInfo): UsbDevice? {
      val extras = info.properties
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        extras.getParcelable(MidiDeviceInfo.PROPERTY_USB_DEVICE, UsbDevice::class.java)
      } else {
        @Suppress("DEPRECATION")
        extras.getParcelable(MidiDeviceInfo.PROPERTY_USB_DEVICE)
      }
    }

    fun usbDeviceExtra(intent: Intent): UsbDevice? {
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
      }
    }
  }
}
