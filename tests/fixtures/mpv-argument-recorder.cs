using System;
using System.IO;
using System.Web.Script.Serialization;

public static class Recorder
{
    public static void Main(string[] args)
    {
        File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "arguments.json"),
            new JavaScriptSerializer().Serialize(args));
    }
}
