/**
 * PlanHub Projects API Route
 * Mock endpoint simulating PlanHub API integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMockPlanHubProjects, getMockPlanHubProject } from '@/lib/mockPlanHubData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phProjectId = searchParams.get('phProjectId');

    // If specific project ID requested, return that project with bid packages
    if (phProjectId) {
      const project = await getMockPlanHubProject(phProjectId);

      if (!project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        project
      });
    }

    // Otherwise return list of all projects
    const projects = await getMockPlanHubProjects();

    return NextResponse.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('PlanHub API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PlanHub projects' },
      { status: 500 }
    );
  }
}
