export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'TechCore E-Commerce & ERP API Documentation',
    version: '1.0.0',
    description: `
**TechCore API** provides full backend support for e-commerce, custom PC builder compatibility, order tracking, and ERP administration.

### Features
- **Security Headers**: Powered by Helmet
- **Request Validation**: Powered by Zod
- **High-Performance Caching**: Powered by Redis with fallback In-Memory Cache
- **Database**: MongoDB Atlas with robust In-Memory Store fallback
    `,
    contact: {
      name: 'TechCore Engineering Team',
      email: 'support@techcore.com'
    }
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment Server'
    },
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from /api/auth/login'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'ভ্যালিডেশন এরর: সঠিক তথ্য প্রদান করুন' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'একটি সঠিক ইমেইল এড্রেস প্রদান করুন' }
              }
            }
          }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'John Doe', minLength: 2 },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', format: 'password', example: 'Secret123!', minLength: 6 },
          phone: { type: 'string', example: '+8801700000000' },
          role: { type: 'string', enum: ['USER', 'CO_ADMIN'], example: 'USER' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', format: 'password', example: 'Secret123!' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login successful!' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '64e8f1b2c3d4e5f6a7b8c9d0' },
              name: { type: 'string', example: 'John Doe' },
              email: { type: 'string', example: 'user@example.com' },
              role: { type: 'string', example: 'USER' },
              status: { type: 'string', example: 'APPROVED' },
              phone: { type: 'string', example: '+8801700000000' }
            }
          }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'prod-101' },
          name: { type: 'string', example: 'Intel Core i5-13400 Processor' },
          slug: { type: 'string', example: 'intel-core-i5-13400-processor' },
          price: { type: 'number', example: 25000 },
          discountPrice: { type: 'number', example: 23500 },
          brand: { type: 'string', example: 'Intel' },
          category: { type: 'string', example: 'Processor' },
          categorySlug: { type: 'string', example: 'processor' },
          stock: { type: 'number', example: 15 },
          stockStatus: { type: 'string', example: 'IN_STOCK' },
          rating: { type: 'number', example: 4.8 },
          images: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string', example: 'AMD Ryzen 7 7800X3D' },
          price: { type: 'number', example: 48000 },
          discountPrice: { type: 'number', example: 45000 },
          brand: { type: 'string', example: 'AMD' },
          category: { type: 'string', example: 'Processor' },
          stock: { type: 'number', example: 20 },
          description: { type: 'string', example: 'Top-tier gaming processor' }
        }
      }
    }
  },
  paths: {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'Server Health & Diagnostics',
        description: 'Check server uptime, database status, and system metadata.',
        responses: {
          '200': {
            description: 'Server is healthy and running'
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register New User or Request Co-Admin Status',
        description: 'Creates a new account. Validated with Zod schema.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          '400': {
            description: 'Validation failed or duplicate email',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate User & Obtain JWT',
        description: 'Login with email and password. Validated with Zod schema.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          '401': {
            description: 'Invalid credentials'
          }
        }
      }
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List Products (Cached)',
        description: 'Retrieve products with optional filtering, sorting, and pagination. Cached via Redis / In-Memory.',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category name or slug' },
          { name: 'brand', in: 'query', schema: { type: 'string' }, description: 'Filter by brand name' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' }, description: 'Minimum price filter' },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Maximum price filter' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search term for name/brand/specs' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'List of products with pagination metadata',
            headers: {
              'X-Cache-Status': {
                schema: { type: 'string', example: 'HIT' },
                description: 'HIT if served from cache, MISS if queried from database'
              }
            }
          }
        }
      },
      post: {
        tags: ['Products'],
        summary: 'Create Product (Admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductRequest' }
            }
          }
        },
        responses: {
          '201': { description: 'Product created successfully' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden: Requires Admin role' }
        }
      }
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get Product Details by ID (Cached)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          '404': { description: 'Product not found' }
        }
      }
    },
    '/api/products/slug/{slug}': {
      get: {
        tags: ['Products'],
        summary: 'Get Product Details by Slug (Cached)',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          '404': { description: 'Product not found' }
        }
      }
    },
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List All Categories (Cached)',
        description: 'Returns active categories, cached for ultra-fast response.',
        responses: {
          '200': { description: 'List of categories' }
        }
      }
    },
    '/api/categories/tree': {
      get: {
        tags: ['Categories'],
        summary: 'Get Hierarchical Category Tree (Cached)',
        description: 'Returns up to 4-level deep category hierarchy for navigation menus.',
        responses: {
          '200': { description: 'Category tree hierarchy' }
        }
      }
    },
    '/api/orders/track': {
      get: {
        tags: ['Orders'],
        summary: 'Public Order Tracking',
        parameters: [
          { name: 'orderId', in: 'query', schema: { type: 'string' } },
          { name: 'phone', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Order tracking timeline and details' },
          '404': { description: 'Order not found' }
        }
      }
    },
    '/api/builder/check': {
      post: {
        tags: ['PC Builder'],
        summary: 'Check PC Component Compatibility',
        description: 'Evaluates socket, TDP, RAM DDR type, and PCIe compatibility across selected parts.',
        responses: {
          '200': { description: 'Compatibility evaluation result with issues or success' }
        }
      }
    }
  }
};

export default swaggerSpec;
