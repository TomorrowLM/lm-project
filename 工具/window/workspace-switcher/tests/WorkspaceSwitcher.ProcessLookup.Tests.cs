using System;
using System.Diagnostics;
using System.Reflection;

// Exercises the real application method under the same .NET Framework runtime.
// No workspace form is created and no user window/state is modified.
internal static class ProcessLookupTests
{
    public static int Main(string[] args)
    {
        Type form = Assembly.LoadFrom(args[0]).GetType("WorkspaceSwitcher.App.WorkspaceForm");
        MethodInfo lookup = form.GetMethod("GetProcessName", BindingFlags.NonPublic | BindingFlags.Static);
        using (Process current = Process.GetCurrentProcess())
        {
            string expected = current.ProcessName + ".exe";
            object[] input = new object[] { (uint)current.Id };
            lookup.Invoke(null, input); // Exclude JIT from the timing budget.
            Stopwatch timer = Stopwatch.StartNew();
            for (int i = 0; i < 200; i++)
            {
                if (!String.Equals((string)lookup.Invoke(null, input), expected, StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine("FAIL process identity must remain stable across repeated window lookups");
                    return 1;
                }
            }
            timer.Stop();
            Console.WriteLine("200 process lookups: " + timer.ElapsedMilliseconds + " ms");
            if (timer.ElapsedMilliseconds >= 1000)
            {
                Console.WriteLine("FAIL process lookups stall the drag UI for at least one second");
                return 1;
            }
        }
        if ((string)lookup.Invoke(null, new object[] { UInt32.MaxValue }) != String.Empty)
        {
            Console.WriteLine("FAIL a vanished process must not become an application candidate");
            return 1;
        }
        Console.WriteLine("PASS process identity and drag lookup latency");
        return 0;
    }
}
