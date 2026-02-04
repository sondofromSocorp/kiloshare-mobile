// Mock Supabase client with chainable query builder pattern

type MockQueryResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
};

interface MockQueryBuilder<T = any> {
  select: jest.Mock<MockQueryBuilder<T>>;
  insert: jest.Mock<MockQueryBuilder<T>>;
  update: jest.Mock<MockQueryBuilder<T>>;
  delete: jest.Mock<MockQueryBuilder<T>>;
  upsert: jest.Mock<MockQueryBuilder<T>>;
  eq: jest.Mock<MockQueryBuilder<T>>;
  neq: jest.Mock<MockQueryBuilder<T>>;
  in: jest.Mock<MockQueryBuilder<T>>;
  not: jest.Mock<MockQueryBuilder<T>>;
  is: jest.Mock<MockQueryBuilder<T>>;
  or: jest.Mock<MockQueryBuilder<T>>;
  order: jest.Mock<MockQueryBuilder<T>>;
  limit: jest.Mock<MockQueryBuilder<T>>;
  gte: jest.Mock<MockQueryBuilder<T>>;
  lte: jest.Mock<MockQueryBuilder<T>>;
  ilike: jest.Mock<MockQueryBuilder<T>>;
  single: jest.Mock<Promise<MockQueryResponse<T>>>;
  maybeSingle: jest.Mock<Promise<MockQueryResponse<T>>>;
  then?: (resolve: Function) => any;
}

export const createMockQueryBuilder = <T = any>(
  defaultResponse: MockQueryResponse<T> = { data: null, error: null }
): MockQueryBuilder<T> => {
  const builder: MockQueryBuilder<T> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve(defaultResponse)),
    maybeSingle: jest.fn(() => Promise.resolve(defaultResponse)),
  };

  // Make the builder thenable for array responses
  Object.defineProperty(builder, 'then', {
    value: (resolve: Function) => resolve(defaultResponse),
    writable: true,
    configurable: true,
  });

  return builder;
};

export const mockSupabaseFrom = jest.fn(() => createMockQueryBuilder());

export const mockSupabaseChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn(),
};

export const mockSupabaseAuth = {
  getSession: jest.fn(() =>
    Promise.resolve({ data: { session: null }, error: null })
  ),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
  signInWithPassword: jest.fn(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  ),
  signUp: jest.fn(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  ),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: null, error: null })),
};

export const mockSupabase = {
  from: mockSupabaseFrom,
  channel: jest.fn(() => mockSupabaseChannel),
  removeChannel: jest.fn(),
  auth: mockSupabaseAuth,
};

// Reset all mocks between tests
export const resetSupabaseMocks = () => {
  mockSupabaseFrom.mockClear();
  mockSupabaseFrom.mockReturnValue(createMockQueryBuilder());
  mockSupabaseChannel.on.mockClear().mockReturnThis();
  mockSupabaseChannel.subscribe.mockClear().mockReturnThis();
  mockSupabaseChannel.unsubscribe.mockClear();
  Object.values(mockSupabaseAuth).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
};

// Helper to mock a specific table query response
export const mockTableResponse = <T>(
  response: MockQueryResponse<T>
): MockQueryBuilder<T> => {
  const builder = createMockQueryBuilder<T>(response);
  mockSupabaseFrom.mockReturnValue(builder);
  return builder;
};

// Helper to mock multiple table responses
export const mockTableResponses = (
  responses: Record<string, MockQueryResponse<any>>
) => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const response = responses[table] || { data: null, error: null };
    return createMockQueryBuilder(response);
  });
};
