Node.js + TypeScript Architectural Rules

1. Core Principles
   Layered Separation: Strictly follow the separation of Concerns: Controller -> Service -> Repository/Model.

Type Safety: No use of any. Every function input, output, and variable must have a defined interface or type.

Dependency Injection: Services should be classes. If a service depends on another service or a database model, it should be passed via the constructor.

2. Folder Structure Standard
   Maintain the following directory hierarchy:

Plaintext

src/
├── config/ # Environment variables and global constants
├── controllers/ # Request parsing and response formatting ONLY
├── services/ # Business logic, third-party integrations
├── repositories/ # Database queries (Mongoose specific logic)
├── models/ # Mongoose schemas and TypeScript interfaces
├── middleware/ # Auth, logging, error handling
├── utils/ # Shared helper functions
├── types/ # Global type definitions / DTOs
└── app.ts # Express entry point

3. Execution Rules
   Controllers: Must not contain business logic or database queries. They handle req validation and call the appropriate Service. Use a standard ApiResponse wrapper.

Services: This is where the "brain" lives. If logic involves multiple models, it happens here. Never access req or res objects here.

Repositories: Encapsulate all Mongoose/MongoDB logic (e.g., .find(), .aggregate()). The rest of the app should not know the database is MongoDB.

Error Handling: Use a centralized error-handling middleware. Throw custom error classes (e.g., AppError(404, "Message")) instead of returning error strings.

4. Code Style & Patterns
   Async/Await: Use try/catch only in the global error handler or where local recovery is possible. Prefer wrapping controllers in an asyncHandler utility.

Environment: Use a strictly typed config.ts powered by dotenv. Never use process.env directly in the code.

Naming: \* Files: kebab-case (e.g., user-controller.ts).

Classes: PascalCase.

Functions/Variables: camelCase.

5. Formatting & Safety
   Use strict: true in tsconfig.json.

Always use Zod or Joi for incoming request validation.

Export logic using ES Modules (export/import), not CommonJS (require).