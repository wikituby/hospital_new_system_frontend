export function extractPatientIdFromDepartmentRequest(request: any): number | null {
  const raw =
    request?.patientId ??
    request?.visit?.patient?.id ??
    request?.visit?.patient?.patientId ??
    request?.patient?.id ??
    request?.patient?.patientId ??
    null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function normalizePatientRecord(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const source = raw.patient ?? raw.data ?? raw;
  if (!source || typeof source !== 'object') {
    return {};
  }

  const pick = (...keys: string[]): any => {
    for (const key of keys) {
      const val = source[key];
      if (val != null && String(val).trim() !== '') {
        return val;
      }
    }
    return '';
  };

  return {
    ...source,
    id: source.id ?? source.patientId ?? null,
    patientId: source.patientId ?? source.id ?? null,
    patientFirstName: pick('patientFirstName', 'firstName', 'patient_first_name'),
    patientSecondName: pick('patientSecondName', 'secondName', 'lastName', 'patient_second_name'),
    patientProfilePic: pick('patientProfilePic', 'profilePic', 'patient_profile_pic'),
    patientFileNo: pick('patientFileNo', 'fileNo', 'patientFileNumber', 'patient_file_no'),
    patientContact: pick('patientContact', 'phone', 'patientPhone', 'patient_contact'),
    patientGender: pick('patientGender', 'gender', 'patient_gender'),
    patientAddress: pick('patientAddress', 'address', 'patient_address'),
    patientAge: pick('patientAge', 'age', 'patient_age'),
    patientDateOfBirth: pick('patientDateOfBirth', 'dateOfBirth', 'patient_date_of_birth'),
    patientOccupation: pick('patientOccupation', 'occupation', 'patient_occupation'),
    nextOfKinName: pick('nextOfKinName', 'nextOfKinsName', 'next_of_kin_name', 'nextOfKin'),
    nextOfKinContact: pick('nextOfKinContact', 'nextOfKinsContact', 'next_of_kin_contact'),
    nextOfKinAddress: pick('nextOfKinAddress', 'nextOfKinsAddress', 'next_of_kin_address'),
    relationship: pick('relationship'),
    diagnosis: pick('diagnosis'),
  };
}

export function buildPatientDisplayName(source: any): string {
  const normalized = normalizePatientRecord(source);
  const fullName = `${normalized.patientFirstName || ''} ${normalized.patientSecondName || ''}`.trim();
  if (fullName) {
    return fullName;
  }
  const combined = (
    source?.patientName ||
    source?.fullName ||
    source?.name ||
    source?.visit?.patientName ||
    ''
  ).toString().trim();
  return combined;
}
