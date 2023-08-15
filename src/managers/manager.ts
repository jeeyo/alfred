interface PackageManager {
  getName(): string;
  getDependencies(): Record<string, string> | Promise<Record<string, string>>;
  getTransitiveDependencies():
    | Record<string, string | null>
    | Promise<Record<string, string | null>>;
}
