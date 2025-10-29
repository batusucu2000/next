// server component (DİKKAT: "use client" YOK)
import { redirect } from 'next/navigation';

export default function PatientsIndex() {
  // /patients açılır açılmaz /patients/upcoming'a yönlendir
  redirect('/patients/upcoming');
}
