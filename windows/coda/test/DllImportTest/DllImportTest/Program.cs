using System.Runtime.InteropServices;

public class DllImportTest
{
    public delegate void CallbackFunction1Delegate(int a, string s1, IntPtr s2, int s2length);

    [DllImport("DllImported.dll", CharSet = CharSet.Unicode)]
    public static extern void set_callback_1(CallbackFunction1Delegate f);

    [DllImport("DllImported.dll", CharSet = CharSet.Unicode)]
    public static extern void dllimport_function_1(int a, [MarshalAs(UnmanagedType.LPStr)] string s);

    public static void callbackFunction1(int a, string s1, IntPtr s2, int s2length)
    {
        Console.WriteLine($"Here is callbackFunction1, a={a}, s1='{s1}', s2='{Marshal.PtrToStringUTF8(s2, s2length)}'");
	Console.Write("s2 bytes:\"");
	for (int i = 0; i < s2length; i++)
	{
	    byte b = Marshal.ReadByte(s2, i);
	    if (b < ' ')
	    {
		Console.Write("\\x");
		Console.Write(BitConverter.ToString([b]));
	    }
	    else
		Console.Write((char)b);
	}
	Console.WriteLine("\"");
    }

    static void Main(string[] args)
    {
        set_callback_1(callbackFunction1);

        Console.WriteLine("Hello");

        dllimport_function_1(42, "HA HA");
    }
}
