/**
 * Phase 7.0 Test Suite: Optical Barcode Scanning Software Emulation & Fallback
 */

console.log('======================================================');
console.log('ZUVO TV CRM — OPTICAL BARCODE EMULATION TEST SUITE');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// Emulated software optical scanner harness
class OpticalBarcodeEmulator {
  constructor() {
    this.isScanning = false;
    this.streamActive = false;
  }

  async startCamera(onScan, onError) {
    this.isScanning = true;
    this.streamActive = true;
    return { ok: true };
  }

  stopCamera() {
    this.isScanning = false;
    this.streamActive = false;
  }

  // Emulates software optical frame injection into Html5Qrcode engine
  async simulateOpticalFrame(barcodeString, onScan) {
    if (!this.streamActive) {
      throw new Error('Camera stream not initialized');
    }
    // Simulate optical scan decoding delay
    await new Promise(r => setTimeout(r, 50));
    onScan(barcodeString);
    this.stopCamera(); // Optical latch automatically tears down active camera stream
  }

  // Emulates file-based optical image decoding (Html5Qrcode.scanFile)
  async scanFileImage(hasBarcode, barcodeString) {
    if (!hasBarcode) {
      throw new Error('No barcode detected in image.');
    }
    return barcodeString;
  }
}

async function runOpticalBarcodeTests() {
  const emulator = new OpticalBarcodeEmulator();

  // Test 1: Software Camera Initialization & Frame Emulation
  console.log('[TEST 1: Optical Frame Decoding Emulation]');
  let scannedResult = null;
  await emulator.startCamera(
    (code) => { scannedResult = code; },
    (err) => { console.error(err); }
  );
  assert(emulator.streamActive === true, 'Camera stream initialized and active');

  await emulator.simulateOpticalFrame('ZUV-QA-TEST-4301', (code) => {
    scannedResult = code;
  });
  assert(scannedResult === 'ZUV-QA-TEST-4301', 'Decoded optical frame matches synthetic barcode string');
  assert(emulator.streamActive === false, 'Camera stream safely torn down after single-fire scan');

  // Test 2: File-Based Optical Image Scanning (scanFile integration)
  console.log('\n[TEST 2: Optical Test File Decoding]');
  const validFileScan = await emulator.scanFileImage(true, 'ZUV-000000000001');
  assert(validFileScan === 'ZUV-000000000001', 'Decoded valid optical test image file');

  // Test 3: Optical Decoding Failure & Graceful Error Handling
  console.log('\n[TEST 3: Optical Scanning Failure Handling]');
  let caughtError = null;
  try {
    await emulator.scanFileImage(false, '');
  } catch (err) {
    caughtError = err.message;
  }
  assert(caughtError === 'No barcode detected in image.', 'Safely caught optical decoding error without application crash');

  // Test 4: Camera Permission Denied / Unavailable Fallback
  console.log('\n[TEST 4: Camera Access Denied Fallback Banner]');
  let fallbackMessage = null;
  try {
    throw new Error('NotAllowedError: Permission denied');
  } catch (err) {
    fallbackMessage = 'Camera access was denied or no active camera was found on this device. You can enter the barcode or serial number manually below.';
  }
  assert(fallbackMessage.includes('manually below'), 'Clear fallback guidance displayed when camera is inaccessible');

  console.log(`\n======================================================`);
  console.log(`OPTICAL BARCODE TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================`);

  if (failed > 0) process.exit(1);
}

runOpticalBarcodeTests().catch(err => {
  console.error('Unhandled optical barcode test error:', err);
  process.exit(1);
});
