'use client';

/**
 * Route-Based Breadcrumbs Component
 * Automatically generates breadcrumbs based on the current URL path
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbSegment {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

// Cache for project and package names fetched from API
const nameCache: Record<string, string> = {};

export default function RouteBreadcrumbs() {
  const pathname = usePathname();
  const [segments, setSegments] = React.useState<BreadcrumbSegment[]>([]);

  React.useEffect(() => {
    const buildBreadcrumbs = async () => {
      const pathSegments = pathname.split('/').filter(Boolean);
      const breadcrumbs: BreadcrumbSegment[] = [];

      // Handle different route patterns
      if (pathname === '/') {
        breadcrumbs.push({ label: 'Projects', isCurrentPage: true });
      } else if (pathname === '/csi') {
        breadcrumbs.push({ label: 'CSI Codes', isCurrentPage: true });
      } else if (pathname === '/admin/users') {
        breadcrumbs.push({ label: 'Users', isCurrentPage: true });
      } else if (pathname === '/projects/new') {
        breadcrumbs.push({ label: 'Projects', href: '/' });
        breadcrumbs.push({ label: 'Create New Project', isCurrentPage: true });
      } else if (pathname === '/projects/review') {
        breadcrumbs.push({ label: 'Projects', href: '/' });
        breadcrumbs.push({ label: 'Create New Project', href: '/projects/new' });
        breadcrumbs.push({ label: 'Review', isCurrentPage: true });
      } else if (pathSegments[0] === 'projects' && pathSegments.length >= 2) {
        const projectId = pathSegments[1];

        // Get project name
        let projectName = nameCache[`project-${projectId}`];
        if (!projectName) {
          try {
            const res = await fetch(`/api/projects/${projectId}`);
            if (res.ok) {
              const data = await res.json();
              projectName = data.project?.name || 'Project';
              nameCache[`project-${projectId}`] = projectName;
            }
          } catch {
            projectName = 'Project';
          }
        }

        breadcrumbs.push({ label: 'Projects', href: '/' });

        if (pathSegments.length === 2) {
          // /projects/:projectId - Bid packages list
          breadcrumbs.push({ label: projectName, isCurrentPage: true });
        } else if (pathSegments[2] === 'upload') {
          // /projects/:projectId/upload
          breadcrumbs.push({ label: projectName, href: `/projects/${projectId}` });
          breadcrumbs.push({ label: 'Upload Diagram', isCurrentPage: true });
        } else if (pathSegments[2] === 'review-diagram') {
          // /projects/:projectId/review-diagram
          breadcrumbs.push({ label: projectName, href: `/projects/${projectId}` });
          breadcrumbs.push({ label: 'Review Document', isCurrentPage: true });
        } else if (pathSegments[2] === 'packages' && pathSegments.length >= 4) {
          const packageId = pathSegments[3];

          // Get package name
          let packageName = nameCache[`package-${packageId}`];
          if (!packageName) {
            try {
              const res = await fetch(`/api/bid-packages/${packageId}`);
              if (res.ok) {
                const data = await res.json();
                packageName = data.bidPackage?.name || 'Bid Package';
                nameCache[`package-${packageId}`] = packageName;
              }
            } catch {
              packageName = 'Bid Package';
            }
          }

          breadcrumbs.push({ label: projectName, href: `/projects/${projectId}` });
          breadcrumbs.push({ label: packageName, isCurrentPage: true });
        }
      }

      setSegments(breadcrumbs);
    };

    buildBreadcrumbs();
  }, [pathname]);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center space-x-1 text-sm">
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          {segment.isCurrentPage ? (
            <span className="text-gray-600 font-medium max-w-[200px] truncate">
              {segment.label}
            </span>
          ) : (
            <Link
              href={segment.href || '/'}
              className="text-gray-500 hover:text-zinc-900 transition-colors font-medium max-w-[200px] truncate"
            >
              {segment.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
