import { Writable, WritableOptions } from 'stream';
import DockerClient from './dockerclient';

class ContainerStdioWritableStream extends Writable {
  private buffer = '';

  constructor(options?: WritableOptions) {
    super(options);
  }

  _write(
    chunk: any,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.buffer += chunk.toString();
    callback();
  }

  getBuffer(): string {
    return this.buffer;
  }

  flush(): void {
    this.buffer = '';
  }
}

export interface ContainerOptions {
  client?: DockerClient;
}

export default class Container {
  private stdout: ContainerStdioWritableStream = new ContainerStdioWritableStream();
  private stderr: ContainerStdioWritableStream = new ContainerStdioWritableStream();

  constructor(
    protected image: string,
    protected entrypoint: string[],
    protected command: string[],
    protected docker: DockerClient,
    protected pwd?: string,
    protected env?: string[],
  ) {}

  private async checkImageExists(): Promise<boolean> {
    const images = await this.docker.listImages();
    return images.some((image) => image.includes(this.image));
  }

  private async pull(): Promise<void> {
    if (await this.checkImageExists()) {
      console.log(`Image ${this.image} already exists, skipping pull...`);
      return;
    }

    console.log(`Pulling ${this.image}...`);
    await this.docker.pull(this.image);
  }

  protected async run(): Promise<void> {
    await this.pull();

    console.log(`Running ${this.image}...`);
    await this.docker.run(
      this.image,
      this.entrypoint,
      this.command,
      this.pwd,
      this.env,
      this.stdout,
      this.stderr,
    );
  }

  protected getStdout(): string {
    return this.stdout.getBuffer();
  }

  protected getStderr(): string {
    return this.stderr.getBuffer();
  }

  protected flushStdout(): void {
    this.stdout.flush();
  }

  protected flushStderr(): void {
    this.stderr.flush();
  }
}
