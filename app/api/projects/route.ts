import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects
 * Fetch all BuildingConnected projects with their relations
 */
export async function GET() {
  try {
    const projects = await prisma.buildingConnectedProject.findMany({
      include: {
        diagrams: {
          orderBy: {
            uploadedAt: 'desc'
          }
        },
        bidPackages: {
          include: {
            bidForms: {
              include: {
                lineItems: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/projects
 * Create a new BuildingConnected project
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bcProjectId,
      accProjectId,
      accDocsFolderId,
      name,
      projectNumber,
      description,
      status,
      bidDueDate,
      expectedStartDate,
      expectedEndDate,
      address,
      city,
      state,
      zipCode,
      country,
      projectSize,
      projectSizeUnit,
      projectValue,
      marketSector,
      typeOfWork,
      architect,
      client,
      accountManager,
      owningOffice,
      feePercentage
    } = body;

    // Validate required fields
    if (!bcProjectId || !name) {
      return NextResponse.json(
        { error: 'bcProjectId and name are required' },
        { status: 400 }
      );
    }

    // Create project
    const project = await prisma.buildingConnectedProject.create({
      data: {
        bcProjectId,
        accProjectId,
        accDocsFolderId,
        name,
        projectNumber,
        description,
        status: status || 'active',
        bidDueDate: bidDueDate ? new Date(bidDueDate) : null,
        expectedStartDate: expectedStartDate ? new Date(expectedStartDate) : null,
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        address,
        city,
        state,
        zipCode,
        country,
        projectSize,
        projectSizeUnit,
        projectValue,
        marketSector,
        typeOfWork,
        architect,
        client,
        accountManager,
        owningOffice,
        feePercentage
      },
      include: {
        diagrams: true,
        bidPackages: true
      }
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating project:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A project with this bcProjectId already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
