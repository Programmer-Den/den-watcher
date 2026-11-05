package den.watcher

import android.bluetooth.BluetoothClass
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BluetoothTest {
    private val devices = listOf(
        BluetoothDevice("AA:BB:CC:DD:EE:01", "Pixel Watch", DeviceKind.WATCH),
        BluetoothDevice("aa:bb:cc:dd:ee:02", "", DeviceKind.HEADPHONES),
        BluetoothDevice("AA:BB:CC:DD:EE:03", "car multimedia", DeviceKind.CAR),
    )

    @Test
    fun makesIdsAsTheBluetoothAddOnDoes() {
        // crc32("AA:BB:CC:DD:EE:02"), the same for the address in small letters.
        assertEquals(BluetoothDevice("AA:BB:CC:DD:EE:02", "", DeviceKind.OTHER).id, devices[1].id)
        assertTrue(devices[0].id.matches(Regex("device-[0-9a-f]{8}")))
    }

    @Test
    fun tellsTheKindsFromTheClassOfDevice() {
        assertEquals(DeviceKind.CAR, Bluetooth.kind(BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO))
        assertEquals(DeviceKind.HEADPHONES, Bluetooth.kind(BluetoothClass.Device.AUDIO_VIDEO_HEADPHONES))
        assertEquals(DeviceKind.WATCH, Bluetooth.kind(BluetoothClass.Device.WEARABLE_WRIST_WATCH))
        assertEquals(DeviceKind.KEYBOARD, Bluetooth.kind(0x0540))
        assertEquals(DeviceKind.MOUSE, Bluetooth.kind(0x0580))
        assertEquals(DeviceKind.PHONE, Bluetooth.kind(BluetoothClass.Device.PHONE_SMART))
        assertEquals(DeviceKind.OTHER, Bluetooth.kind(null))
    }

    @Test
    fun tellsTheDevicesAsTheBluetoothAddOnDoes() {
        val extra = Bluetooth.extra(devices)
        assertEquals(Bluetooth.GROUP, extra.id)
        val connected = extra.values.first()
        assertEquals("connected", connected.id)
        assertEquals(3.0, connected.value!!, 0.0)
        assertTrue(connected.history)
        // By name, the one without a name by its kind.
        assertEquals(listOf("car multimedia", "Headphones", "Pixel Watch"), extra.values.drop(1).map { it.label.en })
        assertEquals("verbunden", extra.values[2].text!!.de)
        assertEquals("Uhr", extra.values[3].text!!.de)
    }

    @Test
    fun keepsTheCountOnlyWhileCollected() {
        val reading = Reading(1_000, 500, 0, null, false, null, 0, 0, 0, 0, emptyMap(), bluetooth = devices)
        assertEquals(3.0, reading.values(emptyMap())["extra:bluetooth/connected"]!!, 0.0)
        assertTrue(reading.limitedTo(DataChoice(bluetooth = false)).extras().isEmpty())
        assertFalse(DataChoice(bluetooth = false).keeps("extra:bluetooth/connected"))
        // No devices while Bluetooth is off is a count of 0.
        assertEquals(0.0, reading.copy(bluetooth = emptyList()).values(emptyMap())["extra:bluetooth/connected"]!!, 0.0)
    }
}
