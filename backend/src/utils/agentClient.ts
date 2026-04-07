import axios, { AxiosInstance } from 'axios';

export class AgentClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, secret: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: { 'X-Agent-Secret': secret, 'Content-Type': 'application/json' },
    });
  }

  async ping(): Promise<any> { return (await this.http.get('/health')).data; }
  async getNodeInfo(): Promise<any> { return (await this.http.get('/info')).data; }

  async createNetwork(name: string): Promise<void> {
    await this.http.post('/networks', { name }).catch(() => {});
  }
  async deleteNetwork(name: string): Promise<void> {
    await this.http.delete('/networks/' + name).catch(() => {});
  }

  async pullImage(image: string): Promise<void> {
    await this.http.post('/images/pull', { image });
  }

  async cloneRepo(serverId: string, url: string, branch: string, token: string | null): Promise<void> {
    await this.http.post('/repo/clone', { serverId, url, branch, token });
  }

  async createContainer(spec: any): Promise<string> {
    return (await this.http.post('/containers', spec)).data.containerId;
  }

  async startContainer(id: string): Promise<void> {
    await this.http.post('/containers/' + id + '/start');
  }

  async powerAction(id: string, action: string): Promise<void> {
    await this.http.post('/containers/' + id + '/power', { action });
  }

  async deleteContainer(id: string, deleteFiles: boolean): Promise<void> {
    await this.http.delete('/containers/' + id, { data: { deleteFiles } });
  }

  async getLogs(id: string, lines: number): Promise<string[]> {
    return (await this.http.get('/containers/' + id + '/logs?lines=' + lines)).data.logs;
  }

  async streamLogs(id: string): Promise<any> {
    return (await this.http.get('/containers/' + id + '/logs/stream', { responseType: 'stream' })).data;
  }

  async execCommand(id: string, command: string): Promise<string> {
    return (await this.http.post('/containers/' + id + '/exec', { command })).data.output;
  }

  async execInteractive(id: string, cols: number, rows: number): Promise<any> {
    return (await this.http.post('/containers/' + id + '/exec/interactive', { cols, rows }, { responseType: 'stream' })).data;
  }

  async getStats(id: string): Promise<{ cpu: number; ram: number; disk: number; netRx: number; netTx: number }> {
    return (await this.http.get('/containers/' + id + '/stats')).data;
  }
}
