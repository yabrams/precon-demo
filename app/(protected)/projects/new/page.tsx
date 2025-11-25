'use client';

/**
 * New Project Page
 * /projects/new route - create a new project
 */

import { useRouter } from 'next/navigation';
import ProjectCreationView from '@/components/ProjectCreationView';

export default function NewProjectPage() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };

  const handleContinue = (data: any) => {
    // Store data in sessionStorage for the review page
    sessionStorage.setItem('projectCreationData', JSON.stringify(data));
    router.push('/projects/review');
  };

  return (
    <ProjectCreationView
      onBack={handleBack}
      onContinue={handleContinue}
    />
  );
}
