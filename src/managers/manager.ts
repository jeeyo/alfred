interface Manager {
  getDependencies(): Record<string, string> | Promise<Record<string, string>>;
}
