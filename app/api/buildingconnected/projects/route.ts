/**
 * BuildingConnected Projects API
 * Mock endpoint for fetching BC projects (until real integration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMockBCProjects, getMockBCProject, getMockBidPackages } from '@/lib/mockBuildingConnectedData';

/**
 * GET /api/buildingconnected/projects
 * Returns list of available BuildingConnected projects
 * Query params:
 *   - bcProjectId: Optional, fetch specific project with bid packages
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bcProjectId = searchParams.get('bcProjectId');

    if (bcProjectId) {
      // Fetch specific project with bid packages
      const project = await getMockBCProject(bcProjectId);
      
      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      const bidPackages = await getMockBidPackages(bcProjectId);

      return NextResponse.json({
        success: true,
        project: {
          ...project,
          bidPackages
        }
      });
    }

    // Fetch all projects
    const projects = await getMockBCProjects();

    return NextResponse.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('BuildingConnected API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BuildingConnected projects' },
      { status: 500 }
    );
  }
}
