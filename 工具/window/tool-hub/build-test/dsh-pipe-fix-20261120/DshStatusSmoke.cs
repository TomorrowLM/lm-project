using System;
using System.Reflection;
class DshStatusSmoke
{
    static int Main(string[] args)
    {
        Assembly assembly = Assembly.LoadFrom(args[0]);
        Type clientType = assembly.GetType("ToolHub.App.DshWebHostClient", true);
        object response = clientType.GetMethod("Request", BindingFlags.Public | BindingFlags.Static)
            .Invoke(null, new object[] { "STATUS" });
        object status = response.GetType().GetProperty("Status").GetValue(response, null);
        string state = status.GetType().GetProperty("State").GetValue(status, null).ToString();
        string message = (string)status.GetType().GetProperty("Message").GetValue(status, null);
        Console.WriteLine("State=" + state + "; Message=" + message);
        return state == "Running" ? 0 : 2;
    }
}