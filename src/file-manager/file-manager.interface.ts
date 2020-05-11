export interface FileManager {
  retrieve(id: string): Promise<string>;
  store(data: string): Promise<string>;
}
