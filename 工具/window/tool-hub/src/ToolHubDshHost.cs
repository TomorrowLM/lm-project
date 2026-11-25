using System;

namespace ToolHub.App
{
    internal static class DshHostProgram
    {
        [STAThread]
        private static void Main()
        {
            DshWebHost.Run();
        }
    }
}
