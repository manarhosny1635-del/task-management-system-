import { redirect } from 'next/navigation';

// "My tasks" now lives inside the Tasks board (the "مهامي" toggle); old links keep working.
export default function MyTasks() {
  redirect('/tasks?mine=1');
}
