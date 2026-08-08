# Survey / QC Excel Shared Field Mapping

**Date:** 2026-08-08  
**Status:** Implementation baseline  
**Word baseline:** Survey field list from mobile (docx not in repo; pasted list used)

## Locked

- Photos: not exported
- Floors: wide pivot for every `FloorPosition` (Area, Usage Factor, Usage Type, Construction Type)
- Tax: `ExportTaxSummary` only (no invented Land/Arrears/Interest)
- QC Final: approved records only (worker)

## Common survey columns → schema

| Excel column                                             | Schema / source                     | Notes                                                                     |
| -------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| S. No                                                    | export serial                       | 1-based                                                                   |
| Survey ID                                                | `propertyId`                        | text                                                                      |
| Status                                                   | `surveyStatus`                      |                                                                           |
| Surveyor Name                                            | `createdBy.fullName`                |                                                                           |
| Survey Date                                              | `submittedAt` ?? `capturedAt`       |                                                                           |
| Assessment Year                                          | `assessmentYear`                    |                                                                           |
| ULB Name                                                 | `ulb.name`                          |                                                                           |
| Ward Number and Name                                     | `ward.wardNumber` + `ward.wardName` | single column: `{number} - {name}`                                        |
| Sector Number                                            | `sectorNo`                          |                                                                           |
| Parcel Number                                            | `parcelNumber`                      | padded text                                                               |
| Unit Number                                              | `unitSubNo`                         | padded text                                                               |
| Old Property Number                                      | `propertyIdOld`                     | text                                                                      |
| Constructed Year                                         | `constructedYear`                   |                                                                           |
| Slum                                                     | `isSlum`                            | Yes/No                                                                    |
| Name of Respondent                                       | `respondentName`                    |                                                                           |
| Respondent Relation with Owner                           | `relationshipWithOwner`             |                                                                           |
| Owner Name                                               | `coOwners[0].name` ?? respondent    | mandatory soft                                                            |
| Father/Husband Name                                      | `coOwners[0].fatherOrHusbandName`   |                                                                           |
| Mobile Number                                            | coOwner/mobile                      | text                                                                      |
| Alternative Mobile Number                                | `alternateMobile` / coOwner         | text                                                                      |
| Number of Family Members                                 | `familySize`                        |                                                                           |
| House Number                                             | `houseDoorNo`                       |                                                                           |
| Locality Name                                            | `locality`                          |                                                                           |
| Colony Name                                              | `colony`                            |                                                                           |
| City                                                     | `city`                              |                                                                           |
| PIN Code                                                 | `pinCode`                           | text                                                                      |
| Ownership Use                                            | `ownershipType`                     |                                                                           |
| Property Type                                            | `propertyType`                      | mandatory soft                                                            |
| Property Use                                             | `propertyUse`                       | mandatory soft                                                            |
| Situation                                                | `situation`                         |                                                                           |
| Road Type                                                | `roadType`                          |                                                                           |
| Taxation Zone                                            | `taxRateZone`                       | survey classification                                                     |
| Plot Area                                                | `plotAreaSqFt`                      | mandatory soft                                                            |
| Plinth Area                                              | `plinthAreaSqFt`                    |                                                                           |
| Total Built-up Area                                      | `totalBuiltAreaSqFt`                |                                                                           |
| `{Floor} Area/Usage Factor/Usage Type/Construction Type` | `floors[]`                          | all FloorPositions; missing floor = blank area + `N/A` text (Ward-1-Etah) |
| Water Connection                                         | `waterConnection`                   |                                                                           |
| Source of Water                                          | `sourceOfWater`                     |                                                                           |
| Sanitation                                               | `sanitationType`                    |                                                                           |
| Door-to-Door Collection                                  | `solidWasteCollection`              | Yes/No                                                                    |
| Electricity Consumer No                                  | `electricityConsumerNo`             | stored string                                                             |
| Latitude / Longitude                                     | lat/lng                             |                                                                           |

## Floor reconciliation (Survey = QC)

QC Final Report uses the **same** `COMMON_SURVEY_COLUMNS` / `toCommonSurveyRow` for its entire survey prefix, including Plot/Plinth/Total Built-up and every floor pivot column in the same order and meaning. Floor values are never recalculated for QC. Only `QC_EXTRA_COLUMNS` (QC metadata + `ExportTaxSummary` demand) are appended after Longitude.

## QC-only

| Excel column                       | Source                                    |
| ---------------------------------- | ----------------------------------------- |
| QC Status                          | `qcStatus`                                |
| QC Approved By                     | audit `qcApprovedByName`                  |
| QC Approval Date                   | `approvedAt`                              |
| QC Remarks                         | `qcRemarks`                               |
| Tax Zone                           | `taxRateZone` (repeat for demand section) |
| Tax Rate                           | zone rate map                             |
| Building Tax                       | `propertyTax`                             |
| Water Tax / Drainage Tax / Penalty | summary                                   |
| Current Demand                     | property+water+drainage                   |
| Total Demand                       | `totalDemand`                             |

## Not exported (no schema / invented)

Category placeholder, Rain Water Harvesting, GIS Status, Land Tax, Conservancy, Other Charges, Arrears, Interest, Tax Category, photo columns.
