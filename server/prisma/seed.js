import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PASSWORD = 'Password1';

const users = [
  ['ADMIN01', 'Admin User', 'admin@nitc.ac.in', 'ADMIN', null],
  ['HOD01', 'HOD (CSE)', 'hod.cse@nitc.ac.in', 'HOD', 'CSE'],
  ['FAC01', 'Faculty Member', 'faculty@nitc.ac.in', 'FACULTY', 'CSE'],
  ['STU01', 'Student One', 'student@nitc.ac.in', 'STUDENT', 'CSE'],
  ['LAB01', 'Lab In-charge', 'lab@nitc.ac.in', 'LAB_INCHARGE', 'CSE'],
  ['MNT01', 'Maintenance Staff', 'maintenance@nitc.ac.in', 'MAINTENANCE_STAFF', null],
  ['TTC01', 'Timetable Coordinator', 'timetable@nitc.ac.in', 'TIMETABLE_COORDINATOR', null],
  ['MGT01', 'Principal', 'principal@nitc.ac.in', 'MANAGEMENT', null],
];

const rooms = [
  { name: 'LH-101', type: 'CLASSROOM', capacity: 60, building: 'Main block', facilities: ['Projector', 'Whiteboard'] },
  { name: 'LH-102', type: 'CLASSROOM', capacity: 60, building: 'Main block', facilities: ['Projector', 'Whiteboard'] },
  { name: 'LH-201', type: 'CLASSROOM', capacity: 120, building: 'Main block', facilities: ['Projector', 'PA system'] },
  { name: 'SEM-1', type: 'CLASSROOM', capacity: 30, building: 'Library', facilities: ['Projector', 'Video conferencing'] },
  { name: 'CS-LAB-1', type: 'LAB', capacity: 40, building: 'CSE block', facilities: ['Air conditioning', 'Projector'] },
  { name: 'CS-LAB-2', type: 'LAB', capacity: 40, building: 'CSE block', facilities: ['Air conditioning'] },
  { name: 'PHY-LAB', type: 'LAB', capacity: 30, building: 'Science block', facilities: ['Fume hood'] },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  for (const [collegeId, name, email, role, department] of users) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { collegeId, name, email, role, department, passwordHash },
    });
  }
  for (const room of rooms) {
    await prisma.room.upsert({ where: { name: room.name }, update: {}, create: room });
  }
  const lab = await prisma.room.findUnique({ where: { name: 'CS-LAB-1' } });
  if ((await prisma.equipment.count({ where: { roomId: lab.id } })) === 0) {
    await prisma.equipment.createMany({
      data: [
        { roomId: lab.id, name: 'Desktop PC', quantity: 40 },
        { roomId: lab.id, name: 'Oscilloscope', quantity: 5, status: 'UNAVAILABLE' },
      ],
    });
  }
  console.log(`Seeded ${users.length} users and ${rooms.length} rooms. Password for all users: ${PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
