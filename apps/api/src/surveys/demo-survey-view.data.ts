import type { AuditHistoryDto, SurveyDetailsDto } from "./dto/survey-view.dto.js"

/** Stable demo property used for Pro Max Survey View previews. */
export const DEMO_SURVEY_PROPERTY_ID = "DEMO-PROP-001"

export function isDemoSurveyPropertyId(propertyId: string): boolean {
  return propertyId.trim().toUpperCase() === DEMO_SURVEY_PROPERTY_ID
}

export function getDemoSurveyDetails(): SurveyDetailsDto {
  return {
    id: "demo-survey-etah-001",
    propertyId: DEMO_SURVEY_PROPERTY_ID,
    ulbName: "Etah Municipal Corporation",
    wardNo: "12",
    parcelNo: "00048",
    ownerName: "Demo Respondent C",
    status: "Approved",
    surveyStatus: "APPROVED",
    qcStatus: "APPROVED",
    district: "Etah",
    sectorZone: "Zone B",
    unitSubNo: "01",
    propertyIdOld: "ETH-OLD-12048",
    constructedYear: "2008",
    surveyor: "Demo Surveyor A",
    slumArea: "No",
    respondentName: "Demo Respondent C",
    mobileNumber: "+91 98765 43210",
    familySize: 4,
    relationshipWithOwner: "Self",
    altMobile: "+91 91234 56780",
    fatherHusbandName: "Demo Guardian C1",
    houseDoorNo: "48-A",
    colonySociety: "Civil Lines Extension",
    localityLandmark: "Near Municipal Water Tank",
    city: "Etah",
    pinCode: "207001",
    coordinates: "27.559830 N, 78.662570 E ± 2.1 m",
    latitude: 27.55983,
    longitude: 78.66257,
    gpsAccuracyMeters: 2.1,
    assessmentYear: "2025-26",
    ownershipType: "Private",
    propertyUse: "Commercial",
    propertyType: "Shop Bakery",
    situation: "Main Road",
    roadType: "Bituminous",
    taxRateZone: "A",
    plotArea: "1800 (167.2 sq m)",
    plinthArea: "1500 (139.4 sq m)",
    builtUpArea: "1500 (139.4 sq m)",
    waterConnection: "Municipal",
    sourceOfWater: "Municipal Supply",
    sanitationType: "Septic Tank",
    doorToDoorCollection: "Yes",
    electricityConsumerNo: "ETH-ELEC-778812",
    frontPhotoUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80",
    sidePhotoUrl: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80",
    owners: [
      {
        propertyId: DEMO_SURVEY_PROPERTY_ID,
        name: "Demo Co-owner C1",
        fatherHusband: "Demo Guardian C1",
        mobile: "+91 98765 43211",
        altMobile: "+91 90000 11122",
      },
      {
        propertyId: DEMO_SURVEY_PROPERTY_ID,
        name: "Demo Co-owner C2",
        fatherHusband: "Demo Guardian C2",
        mobile: "+91 98765 43212",
        altMobile: "—",
      },
    ],
    floors: [
      {
        sNo: 1,
        floor: "Ground",
        usageType: "Commercial",
        usageFactor: "Commercial",
        construction: "RCC",
        area: "1500 Sqft",
      },
      {
        sNo: 2,
        floor: "First",
        usageType: "Commercial",
        usageFactor: "Commercial",
        construction: "RCC",
        area: "900 Sqft",
      },
    ],
    photos: [
      {
        id: "demo-photo-front",
        photoType: "FRONT",
        label: "Front View",
        url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80",
        capturedAt: "14 Jul 2026, 10:24 AM",
        surveyorName: "Demo Surveyor A",
      },
      {
        id: "demo-photo-side",
        photoType: "SIDE",
        label: "Side View",
        url: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80",
        capturedAt: "14 Jul 2026, 10:26 AM",
        surveyorName: "Demo Surveyor A",
      },
    ],
    qcRemarks: null,
    qcRemarkItems: [],
  }
}

export function getDemoAuditHistory(): AuditHistoryDto[] {
  return [
    {
      propertyId: DEMO_SURVEY_PROPERTY_ID,
      when: "14 Jul 2026, 11:05 AM",
      action: "QC Approved",
      actor: "QC Supervisor Demo",
      role: "QC Reviewer",
      details: "—",
    },
    {
      propertyId: DEMO_SURVEY_PROPERTY_ID,
      when: "14 Jul 2026, 10:40 AM",
      action: "Submitted",
      actor: "Demo Surveyor A",
      role: "Surveyor",
      details: "—",
    },
    {
      propertyId: DEMO_SURVEY_PROPERTY_ID,
      when: "14 Jul 2026, 09:18 AM",
      action: "Updated",
      actor: "Demo Surveyor A",
      role: "Surveyor",
      details: "—",
    },
    {
      propertyId: DEMO_SURVEY_PROPERTY_ID,
      when: "13 Jul 2026, 04:52 PM",
      action: "Created",
      actor: "Demo Surveyor A",
      role: "Surveyor",
      details: "—",
    },
  ]
}
