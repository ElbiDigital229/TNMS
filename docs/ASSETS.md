# Assets

## Routes

- `/assets` - Asset list (global view)
- `/assets/:code` - Asset detail (by QR code)
- `/asset-view/:code` - Asset detail (alternate public route)

## Permissions

- `ASSETS.VIEW` - View asset list
- `ASSETS.CREATE` - Create new assets
- `ASSETS.EDIT` - Edit asset details
- `ASSETS.DEACTIVATE` - Deactivate/activate assets
- `ASSETS.EXPORT` - Export asset data
- `ASSETS.IMPORT` - Bulk import assets
- `ASSETS.QR_DOWNLOAD` - Download QR codes

## Asset Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Asset name |
| code | String | Unique QR/barcode identifier |
| description | String? | Optional description |
| condition | Enum | EXCELLENT, GOOD, FAIR, POOR |
| categoryId | UUID | Asset category reference |
| propertyId | UUID | Property where asset is located |
| floorId | UUID? | Floor location |
| unitId | UUID? | Unit location |
| imagePath | String? | Uploaded asset image |
| purchaseDate | DateTime? | When asset was purchased |
| purchaseCost | Float? | Original cost |
| status | Enum | ACTIVE or INACTIVE |

## Asset List Page

### Filters
- **Category**: Dropdown of asset categories
- **Condition**: Excellent, Good, Fair, Poor
- **Property**: Dropdown of accessible properties
- **Status**: Active/Inactive
- **Search**: Free-text search on name or code

### Bulk Actions
- Select multiple assets via checkboxes
- Floating action bar appears with:
  - **Activate Selected** - Set all to active
  - **Deactivate Selected** - Set all to inactive
  - **Export Selected** - Download CSV of selected assets

### Create Asset
- Modal form with fields: name, code, category, condition, property, floor, unit
- Property -> floor -> unit cascading selection
- Image upload

## Asset Detail Page

- Full asset information display
- Condition badge (color-coded: green/blue/amber/red)
- Property and unit location
- Purchase information
- Image viewer
- **Related Tickets** section showing all tickets linked to this asset
- QR code display/download

## Asset Categories

Managed at `/settings/asset-categories`:
- Create, edit, activate/deactivate categories
- Categories used to classify assets (e.g., HVAC, Plumbing, Electrical)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/assets | List all (filtered, paginated) |
| GET | /api/assets/:id | Get by ID |
| GET | /api/assets/code/:code | Get by code (no auth required) |
| GET | /api/properties/:propertyId/assets | List by property |
| POST | /api/properties/:propertyId/assets | Create (multipart) |
| PUT | /api/assets/:id | Update (multipart) |
| PATCH | /api/assets/:id/deactivate | Deactivate |
| PATCH | /api/assets/:id/activate | Activate |
| GET | /api/assets/:id/tickets | Get linked tickets |
| POST | /api/properties/:propertyId/assets/bulk-import | Bulk import |
| POST | /api/properties/:propertyId/assets/bulk-delete | Bulk delete |
| POST | /api/assets/bulk-status | Bulk activate/deactivate |

## Notifications

- `ASSET_CONDITION_POOR` - Triggered when an asset's condition is set to POOR, notifies property ticket viewers
