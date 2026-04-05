# Properties

## Routes

- `/properties` - Property list
- `/properties/new` - Create property
- `/properties/:id` - Property detail
- `/properties/:id/edit` - Edit property

## Permissions

- `PROPERTIES.VIEW` - View property list
- `PROPERTIES.CREATE` - Create new properties
- `PROPERTIES.EDIT` - Edit existing properties
- `PROPERTIES.DEACTIVATE` - Deactivate/activate properties
- `PROPERTIES.EXPORT` - Export property data as CSV

## Property Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Property name |
| type | Enum | FLOOR, BUILDING, or COMPOUND |
| city | Enum | LAHORE or ISLAMABAD |
| address | String | Street address |
| areaGroupId | UUID? | Optional area group reference |
| imagePath | String? | Uploaded property image |
| status | Enum | ACTIVE or INACTIVE |
| latitude/longitude | Float? | GPS coordinates |

## Property List Page

- Filterable by: city, property type, status, area group
- Searchable by name or address
- Sortable columns
- Pagination
- Bulk export to CSV
- Click row to view detail

## Property Detail Page

Tabbed interface showing:

### Floors Tab
- List of floors in the property
- Create, edit, activate/deactivate floors
- Bulk import floors from spreadsheet
- Bulk delete floors

### Units Tab
- List of units grouped by floor
- Create, edit, activate/deactivate units
- Bulk import units
- Bulk delete units

### Assets Tab
- Assets located in this property
- Filterable by category, condition, status
- Create new assets
- Click to view asset detail

## Hierarchy

```
Property
  -> Floor (e.g., "Ground Floor", "1st Floor")
       -> Unit (e.g., "Apt 101", "Office 3B")
            -> Assets (equipment in this unit)
            -> Tickets (work orders for this unit)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/properties | List properties (filtered, paginated) |
| GET | /api/properties/:id | Get property with floors, units |
| POST | /api/properties | Create (multipart with image) |
| PUT | /api/properties/:id | Update (multipart with image) |
| PATCH | /api/properties/:id/deactivate | Deactivate property |
| PATCH | /api/properties/:id/activate | Reactivate property |
| GET | /api/properties/export | Export CSV |

### Floor Endpoints (nested under properties)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/properties/:propertyId/floors | List floors |
| POST | /api/properties/:propertyId/floors | Create floor |
| PUT | /api/properties/floors/:id | Update floor |
| PATCH | /api/properties/floors/:id/deactivate | Deactivate |
| PATCH | /api/properties/floors/:id/activate | Activate |
| POST | /api/properties/:propertyId/floors/bulk-import | Bulk import |
| DELETE | /api/properties/floors/bulk-delete | Bulk delete |

### Unit Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/units | List all units globally |
| GET | /api/properties/:propertyId/units | List property units |
| POST | /api/properties/:propertyId/units | Create unit |
| PUT | /api/properties/units/:id | Update unit |
| PATCH | /api/properties/units/:id/deactivate | Deactivate |
| PATCH | /api/properties/units/:id/activate | Activate |
| POST | /api/properties/:propertyId/units/bulk-import | Bulk import |
| POST | /api/properties/units/bulk-delete | Bulk delete |

## Notifications

- `PROPERTY_DEACTIVATED` - Sent to all users assigned to the property when it is deactivated
