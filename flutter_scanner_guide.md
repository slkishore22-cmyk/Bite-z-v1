# Flutter Scanner & Thermal Printer Configuration Guide

Use the following API key and endpoint to configure your Flutter mobile scanner application. This API will authenticate the mobile scanner, update order status to `scanned` in real-time, and return order metadata along with a print-ready plain text receipt payload optimized for thermal printers.

---

## 1. Credentials & Endpoint Details

- **HTTP Method**: `POST`
- **Endpoint URL**: `https://umayieigsqcbxgaqwssu.supabase.co/functions/v1/scan-order`
- **Required Headers**:
  - `Content-Type`: `application/json`
  - `x-api-key`: `bitez_flutter_scanner_secret_2026`

---

## 2. API Request Specification

### Request Body (JSON)
```json
{
  "qr_code": "BITEZ-8A2F9B1E-1719163012123"
}
```

*Note: The `qr_code` value is read directly from the scanned QR code displayed on the customer's payment screen.*

---

## 3. API Response Specification

### Response Body (JSON - Status 200)
```json
{
  "status": "success",
  "message": "Order marked as scanned successfully",
  "scanner_device": "Simulated Mock Scanner (Default)",
  "order": {
    "id": "e932b130-9b4f-4a0e-bc3d-1a8c084f72ea",
    "order_number": "ORD-6F9D28B10A",
    "amount": 250.00,
    "status": "scanned",
    "items": [
      {
        "itemId": "item-001",
        "name": "Paneer Butter Masala",
        "icon": "🍛",
        "price": 180.00,
        "qty": 1
      },
      {
        "itemId": "item-002",
        "name": "Garlic Naan",
        "icon": "🫓",
        "price": 35.00,
        "qty": 2
      }
    ],
    "canteen_name": "Main Canteen",
    "upi_id": "canteen1@upi"
  },
  "thermal_receipt_payload": "================================\n          MAIN CANTEEN\n================================\nOrder: #ORD-6F9D28B10A\nDate: 23/6/2026, 5:10:00 pm\nCust: customer@bitez.com\n--------------------------------\nItems: \n🍛 Paneer Butter Masala\n  1 x Rs.180.00     Rs.  180.00\n🫓 Garlic Naan\n  2 x Rs.35.00      Rs.   70.00\n--------------------------------\nTOTAL AMOUNT:      Rs.  250.00\nPayment: UPI Pending Scan\nStatus: SCANNED - CONFIRMED\n================================\n  Thank you for your order!     \n================================"
}
```

---

## 4. Flutter Integration Code Example

You can use the `http` package in your Flutter app to scan and trigger printing:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> scanAndPrintOrder(String scannedQrValue) async {
  final url = Uri.parse('https://umayieigsqcbxgaqwssu.supabase.co/functions/v1/scan-order');
  
  try {
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'bitez_flutter_scanner_secret_2026',
      },
      body: jsonEncode({
        'qr_code': scannedQrValue,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      print("Scan Success: ${data['message']}");
      
      // Send receipt block directly to thermal printer
      String receiptText = data['thermal_receipt_payload'];
      await printToThermalPrinter(receiptText);
      
    } else {
      final err = jsonDecode(response.body);
      print("Scan Failed: ${err['error']}");
    }
  } catch (e) {
    print("Network Error: $e");
  }
}

Future<void> printToThermalPrinter(String receiptText) async {
  // Use blue_thermal_printer or esc_pos_printer library:
  // e.g., bluetoothPrinter.writeBytes(utf8.encode(receiptText + "\n\n\n"));
  print("Sending payload to thermal printer:\n$receiptText");
}
```
