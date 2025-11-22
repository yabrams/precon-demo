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
 * Create a new BuildingConnected project with diagrams and bid packages
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
      projectStartDate,
      projectEndDate,
      expectedStartDate,
      expectedEndDate,
      location,
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
      projectType,
      buildingType,
      architect,
      architectName,
      client,
      ownerName,
      engineerName,
      generalContractorName,
      accountManager,
      owningOffice,
      feePercentage,
      estimatedSquareFootage,
      numberOfFloors,
      projectPhase,
      fundingType,
      deliveryMethod,
      contractType,
      bondingRequired,
      prevailingWageRequired,
      minorityBusinessGoal,
      womenBusinessGoal,
      uploadedDocuments,
      bidPackages
    } = body;

    // Validate required fields
    if (!bcProjectId || !name) {
      return NextResponse.json(
        { error: 'bcProjectId and name are required' },
        { status: 400 }
      );
    }

    // Handle location (can be nested object or flat fields)
    const projectAddress = location?.address || address;
    const projectCity = location?.city || city;
    const projectState = location?.state || state;
    const projectZipCode = location?.zipCode || zipCode;
    const projectCountry = location?.country || country;

    // Create project with diagrams and bid packages in a transaction
    const project = await prisma.$transaction(async (tx) => {
      // Create project
      const newProject = await tx.buildingConnectedProject.create({
        data: {
          bcProjectId,
          accProjectId,
          accDocsFolderId,
          name,
          projectNumber,
          description,
          status: status || 'active',
          bidDueDate: bidDueDate ? new Date(bidDueDate) :
                      (projectStartDate ? new Date(projectStartDate) : null),
          expectedStartDate: expectedStartDate ? new Date(expectedStartDate) :
                            (projectStartDate ? new Date(projectStartDate) : null),
          expectedEndDate: expectedEndDate ? new Date(expectedEndDate) :
                          (projectEndDate ? new Date(projectEndDate) : null),
          address: projectAddress,
          city: projectCity,
          state: projectState,
          zipCode: projectZipCode,
          country: projectCountry,
          projectSize: projectSize || estimatedSquareFootage,
          projectSizeUnit: projectSizeUnit || 'SF',
          projectValue,
          marketSector,
          typeOfWork: typeOfWork || projectType,
          architect: architect || architectName,
          client: client || ownerName,
          accountManager,
          owningOffice,
          feePercentage
        }
      });

      // Create diagrams if provided
      if (uploadedDocuments && uploadedDocuments.length > 0) {
        await Promise.all(
          uploadedDocuments.map((doc: any) =>
            tx.diagram.create({
              data: {
                bcProjectId: newProject.id,
                fileName: doc.fileName,
                fileUrl: doc.url,
                fileType: doc.fileType,
                fileSize: doc.fileSize,
                uploadedBy: doc.uploadedBy || null
              }
            })
          )
        );
      }

      // Create bid packages if provided
      if (bidPackages && bidPackages.length > 0) {
        await Promise.all(
          bidPackages.map((pkg: any) =>
            tx.bidPackage.create({
              data: {
                bcBidPackageId: pkg.bcBidPackageId || `${bcProjectId}-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`,
                bcProjectId: newProject.id,
                name: pkg.name,
                description: pkg.description,
                scope: pkg.scope,
                status: pkg.status || 'draft',
                progress: pkg.progress || 0,
                bidDueDate: pkg.bidDueDate ? new Date(pkg.bidDueDate) : null,
                diagramIds: pkg.diagramIds ? JSON.stringify(pkg.diagramIds) : null
              }
            })
          )
        );
      }

      // Fetch complete project with relations
      return await tx.buildingConnectedProject.findUnique({
        where: { id: newProject.id },
        include: {
          diagrams: {
            orderBy: {
              uploadedAt: 'desc'
            }
          },
          bidPackages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });
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
      { error: 'Failed to create project', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
