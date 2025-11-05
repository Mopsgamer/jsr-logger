export function patchOutput() {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };
  function outputUnpatch(): void {
    process.stdout.write = originalWrite;
  }
  return { output, outputUnpatch };
}
