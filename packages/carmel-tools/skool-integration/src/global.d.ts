// Add type definition for Object.groupBy which is available in ES2024
declare global {
  interface ObjectConstructor {
    groupBy<T, K extends PropertyKey>(
      items: Iterable<T>,
      keySelector: (item: T) => K,
    ): Record<K, T[]>
  }
}

export {}
