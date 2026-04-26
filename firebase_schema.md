# ZimFarm ERP - Firebase Firestore Schema

This document outlines the Firestore collection structure and data models for the ZimFarm ERP system, inferred from the application's state management and `localStorage` persistence.

## Collections

### 1. `activities`
Stores a log of recent farm activities and system notifications.

| Field | Type | Description |
| :--- | :--- | :--- |
| `type` | String | Notification type: `success`, `warning`, `info`, `danger`. |
| `title` | String | Short title of the activity. |
| `info` | String | Detailed description/information. |
| `time` | String | Relative time string (e.g., "2h ago") or ISO timestamp. |
| `icon` | String | FontAwesome icon class (e.g., `fa-oil-can`). |

---

### 2. `inventory`
Tracks farm inputs, fuel, and other stock items.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique document ID (e.g., `diesel`, `Compound D`). |
| `name` | String | Display name of the item. |
| `qty` | Number | Remaining quantity in stock. |
| `unit` | String | Unit of measurement (e.g., `Liters`, `50kg Bags`). |
| `icon` | String | FontAwesome icon class. |

---

### 3. `fields`
Management of farm land segments and crop status.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique field identifier. |
| `name` | String | Name of the field (e.g., `North Field`). |
| `crop` | String | Current crop planted or `Fallow`. |
| `acres` | Number | Size of the field in acres. |
| `status` | String | Current status (e.g., `Needs Weeding`, `Preparing Land`). |

---

### 4. `equipment`
Tracking status and maintenance of farm machinery.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique equipment ID (e.g., `Tractor #1`). |
| `name` | String | Equipment name/model. |
| `status` | String | Operational status: `Running`, `Offline`. |
| `hours` | Number | Total operational hours. |
| `lastService` | String | Summary of the last maintenance performed. |
| `icon` | String | FontAwesome icon class. |

---

### 5. `livestock`
Inventory and health tracking for farm animals.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique ID (often `tag-timestamp`). |
| `tag` | String | Physical ear tag or batch ID. |
| `name` | String | Species/Category name (e.g., `Brahman Cattle`). |
| `breed` | String | Breed of the animal(s). |
| `count` | Number | Number of animals in the batch/entry. |
| `status` | String | Health status: `Healthy`, `Sick`, `Quarantined`. |
| `notes` | String | Additional details/history. |
| `icon` | String | FontAwesome icon class. |

---

## Global State / Config
The application also maintains global balances and system settings.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `usdBalance` | Number | Current cash on hand in USD. |
| `exchangeRate` | Number | Current USD to ZiG conversion rate. |
| `currency` | String | Preferred display currency (`USD` or `ZiG`). |
