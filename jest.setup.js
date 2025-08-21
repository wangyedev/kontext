// Global test setup
process.env.NODE_ENV = 'test';

// Mock external dependencies that might be problematic in tests
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Extend expect with custom matchers if needed
expect.extend({
  // Custom matchers can be added here
});

// Global beforeEach setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});