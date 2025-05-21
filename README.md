# Enterprise Inventory Management System

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=for-the-badge&logo=amazon-dynamodb&logoColor=white)
![SST](https://img.shields.io/badge/SST-FF0000?style=for-the-badge)

### Business Context & User Considerations

- **Small-to-medium retailers** who need to track inventory across locations
- **Warehouse managers** who require real-time alerts when stock runs low
- **Business owners** who want insights into inventory value and turnover
- **Staff with varying technical abilities** who need an intuitive interface

I prioritized features based on user pain points I've observed in retail environments: manual inventory tracking leading to stockouts, lack of visibility into inventory status, and no historical tracking for audit purposes.

## Architecture

Serverless architecture to create a solution that could scale with a business's growth while keeping operational costs low during periods of light usage:

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|  React Frontend   |------>|  API Gateway      |------>|  AWS Lambda       |
|  TypeScript       |       |  REST Endpoints   |       |  Serverless       |
|                   |       |                   |       |  Functions        |
+-------------------+       +-------------------+       +--------+----------+
                                                                 |
                                                                 v
                             +-------------------+       +-------------------+
                             |                   |       |                   |
                             |  S3 Bucket        |<------|  DynamoDB         |
                             |  Image Storage    |       |  Data Storage     |
                             |                   |       |                   |
                             +-------------------+       +-------------------+
```

## Technical Decisions & Learning Journey

### TypeScript Implementation

- Creating precise interfaces for API contracts
- Using discriminated unions for state management
- Implementing generic types for reusable components
- Adding comprehensive type guards for runtime safety

### React Patterns

- I implemented custom hooks to abstract business logic, making components more focused and testable
- I used React Query for data fetching to solve caching, loading states, and error handling challenges
- For forms, I combined React Hook Form with Zod validation, creating a type-safe form system that provides excellent user feedback

### AWS & Serverless

Learning AWS services was one of my primary goals with this project:

- I chose SST as an entry point into AWS development, allowing me to define infrastructure with TypeScript
- I designed DynamoDB tables with careful consideration of access patterns and query efficiency
- I implemented Lambda functions with proper error handling and environment variable management
- I integrated S3 for image storage with secure upload policies

## Technical Growth Reflections

1. **Database design**: I've learned that NoSQL databases require a different mental model, designing for query patterns rather than normalized relations
2. **Infrastructure management**: Using SST showed me how infrastructure-as-code simplifies deployment and ensures consistency
3. **API design**: I realized the importance of careful API design for maintainability and performance

## Future Directions

- Adding real-time updates with WebSockets
- Implementing more sophisticated alerting with AWS SES
- Creating a mobile-responsive design for warehouse staff on the move
- Adding reporting features for business intelligence

---

*This project represents my journey from frontend-focused development to full-stack engineering. While it's still evolving, it demonstrates my ability to think through complex business requirements and implement solutions with scalability, maintainability, and user experience in mind.*