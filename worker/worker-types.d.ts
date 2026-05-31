type R2PutValue = ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob;

type R2Object = {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata?: {
    contentType?: string;
  };
  writeHttpMetadata(headers: Headers): void;
};

type R2ObjectBody = R2Object & {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
};

type R2Objects = {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
};

type R2Bucket = {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: R2PutValue,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    },
  ): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<R2Objects>;
};
