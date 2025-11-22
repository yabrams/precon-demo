/**
 * ConstructConnect Projects API Route
 * Mock endpoint simulating ConstructConnect API integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMockConstructConnectProjects, getMockConstructConnectProject } from '@/lib/mockConstructConnectData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ccProjectId = searchParams.get('ccProjectId');

    // If specific project ID requested, return that project with bid packages
    if (ccProjectId) {
      const project = await getMockConstructConnectProject(ccProjectId);

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
    const projects = await getMockConstructConnectProjects();

    return NextResponse.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('ConstructConnect API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ConstructConnect projects' },
      { status: 500 }
    );
  }
}
