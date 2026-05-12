/**
 * Patches process.stdout.write to capture output.
 * @returns An object containing the captured output array and an unpatch function.
 */
export function patchOutput(): {
  /**
   * The captured output lines.
   */
  output: string[];
  /**
   * A function to restore the original process.stdout.write.
   */
  outputUnpatch: () => void;
} {
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
