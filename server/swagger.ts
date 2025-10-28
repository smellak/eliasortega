import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Warehouse Appointments API",
      version: "1.0.0",
      description: "API for managing warehouse appointments with capacity validation",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["ADMIN", "PLANNER", "BASIC_READONLY"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Provider: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            notes: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CapacityShift: {
          type: "object",
          properties: {
            id: { type: "string" },
            startUtc: { type: "string", format: "date-time" },
            endUtc: { type: "string", format: "date-time" },
            workers: { type: "integer", minimum: 0 },
            forklifts: { type: "integer", minimum: 0 },
            docks: { type: "integer", minimum: 0, maximum: 3, nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Appointment: {
          type: "object",
          properties: {
            id: { type: "string" },
            providerId: { type: "string", nullable: true },
            providerName: { type: "string" },
            startUtc: { type: "string", format: "date-time" },
            endUtc: { type: "string", format: "date-time" },
            workMinutesNeeded: { type: "integer", minimum: 0 },
            forkliftsNeeded: { type: "integer", minimum: 0 },
            goodsType: { type: "string", nullable: true },
            units: { type: "integer", nullable: true },
            lines: { type: "integer", nullable: true },
            deliveryNotesCount: { type: "integer", nullable: true },
            externalRef: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CapacityConflict: {
          type: "object",
          properties: {
            minute: { type: "string", format: "date-time" },
            minuteMadrid: { type: "string" },
            workUsed: { type: "number" },
            workAvailable: { type: "number" },
            forkliftsUsed: { type: "integer" },
            forkliftsAvailable: { type: "integer" },
            docksUsed: { type: "integer" },
            docksAvailable: { type: "integer" },
            failedRule: { type: "string", enum: ["work", "forklifts", "docks"] },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ["./server/routes.ts"], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
