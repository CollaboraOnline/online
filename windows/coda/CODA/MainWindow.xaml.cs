// -*- tab-width: 4; indent-tabs-mode: nil; fill-column: 100 -*-

using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Microsoft.Win32;

namespace CODA
{
    public partial class MainWindow : Window
    {
        public struct pollfd {
            public int fd;
            public short events;
            public short revents;
        };

        private IWebView2 _iWebView2;

        private bool _isNavigating = false;

        public delegate void Send2JSDelegate(IntPtr buffer, int length);

        [DllImport("CODALib.dll")]
        public static extern int get_coolwsd_server_socket_fd();

        [DllImport("CODALib.dll")]
        public static extern int set_coolwsd_server_socket_fd(int fd);

        [DllImport("CODALib.dll")]
        public static extern int generate_new_app_doc_id();

        [DllImport("CODALib.dll")]
        public static extern int fakeSocketSocket();
        
        [DllImport("CODALib.dll")]
        public static extern int fakeSocketPipe2(int[] pipefds);

        [DllImport("CODALib.dll")]
        public static extern int fakeSocketPoll(pollfd[] fds, int nfds, int timeout);

        [DllImport("CODALib.dll")]
        public static extern int fakeSocketListen(int fd);

        [DllImport("CODALib.dll")]
        public static extern int fakeSocketConnect(int fd1, int fd2);

        [DllImport("CODALib.dll")]
        public static extern int fakeSocketAccept4(int fd);

        [DllImport("CODALib.dll")]
        public static extern int fakeSocketPeer(int fd);

        [DllImport("CODALib.dll")]
        public static extern long fakeSocketAvailableDataLength(int fd);

        [DllImport("CODALib.dll")]
        public static extern long fakeSocketRead(int fd, byte[] buf, long nbytes);

        [DllImport("CODALib.dll")]
        public static extern long fakeSocketWrite(int fd, byte[] buf, long nbytes);

        [DllImport("CODALib.dll")]
        public static extern long fakeSocketShutdown(int fd);

        [DllImport("CODALib.dll")]
        public static extern long fakeSocketClose(int fd);

        [DllImport("CODALib.dll")]
        public static extern long fakeSocketDumpState();

        [DllImport("CODALib.dll")]
        public static extern void initialize_cpp_things();

        [DllImport("CODALib.dll")]
        public static extern void set_send2JS_function(Send2JSDelegate f);

        [DllImport("CODALib.dll")]
        public static extern void do_hullo_handling_things(String fileURL, int appDocId);

        [DllImport("CODALib.dll")]
        public static extern void do_bye_handling_things();

        [DllImport("CODALib.dll")]
        public static extern void do_other_message_handling_things([MarshalAs(UnmanagedType.LPStr)] string message);

        // Keep a static reference so that the delegate doesn't get garbage collected. Or something
        // like that.
        // private static Send2JSDelegate _reference;
        private static GCHandle _gch;

        private int _appDocId = -1;

        private String _fileURL;

        public MainWindow()
        {
            Loaded += MainWindow_Loaded;
            InitializeComponent();
            Send2JSDelegate fp = new Send2JSDelegate(send2JS);
            _gch = GCHandle.Alloc(fp);
            set_send2JS_function(fp);
            initialize_cpp_things();
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            SetWebView(webView2XamlElement);
            await InitializeWebView(webView2XamlElement);
            _iWebView2.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
        }

        private void MainWindow_FileOpen(object sender, RoutedEventArgs e)
        {
            OpenFileDialog openFileDialog = new OpenFileDialog();
            openFileDialog.Filter =
                "Text documents|*.odt;*.docx;*.doc|" +
                "Spreadsheets|*.ods;*.xlsx;*.xls|" +
                "Presentations|*.odp;*.pptx;*.ppt|" +
                "All files|*.*";

            if (openFileDialog.ShowDialog() == true)
            {
                _appDocId = generate_new_app_doc_id();
                _fileURL = new Uri(openFileDialog.FileName).AbsoluteUri;
                openCOOL();
            }
        }

        private void MainWindow_Exit(object sender, RoutedEventArgs e)
        {
            System.Windows.Application.Current.Shutdown();
        }

        void WebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            string s = args.WebMessageAsJson;
            Debug.WriteLine($"WebView_WebMessageReceived: {s}");

            if (s.StartsWith("\"MSG "))
            {
                s = s.Substring(5);
                if (s == "HULLO\"")
                {
                    do_hullo_handling_things(_fileURL, _appDocId);
                }
                else if (s == "BYE\"")
                {
                    do_bye_handling_things();
                }
                else if (s == "PRINT\"")
                {
                    Debug.WriteLine("Not yet implemented: Print");
                }
                else if (s.StartsWith("downloadas "))
                {
                    Debug.WriteLine("Not yet implemented: Save As");
                }
                else
                {
                    string message = JsonSerializer.Deserialize<string>(args.WebMessageAsJson);
                    message = message.Substring(4);
                    do_other_message_handling_things(message);
                }
            }
            else if (s.StartsWith("\"ERR "))
            {
                string message = JsonSerializer.Deserialize<string>(args.WebMessageAsJson);
                message = message.Substring(4);
                Debug.WriteLine($"Error: {message}");
            }
            else if (s.StartsWith("\"DBG "))
            {
                string message = JsonSerializer.Deserialize<string>(args.WebMessageAsJson);
                message = message.Substring(4);
                Debug.WriteLine($"Debug: {message}");
            }
        }

        private void SetWebView(IWebView2 newWebView2)
        {
            _iWebView2 = newWebView2;

            // We display the type of control in the window title, so update that now.
            UpdateTitle();
        }

        async Task InitializeWebView(IWebView2 webView2)
        {
            AttachControlEventHandlers(webView2);
            webView2.DefaultBackgroundColor = System.Drawing.Color.Transparent;
            await webView2.EnsureCoreWebView2Async();
        }

        void AttachControlEventHandlers(IWebView2 control)
        {
            control.NavigationStarting += WebView_NavigationStarting;
            control.NavigationCompleted += WebView_NavigationCompleted;
            control.CoreWebView2InitializationCompleted += WebView_CoreWebView2InitializationCompleted;
        }

        void WebView_NavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            _isNavigating = true;

            CoreWebView2NavigationKind kind = e.NavigationKind;
        }

        void WebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            _isNavigating = false;
        }

        private void openCOOL()
        {
            // Hide the helpful note
            useFileDialogXamlElement.Visibility = Visibility.Collapsed;
            // Also hide the initial menu as COOL has its own
            menuXamlElement.Visibility = Visibility.Collapsed;

            // FIXME: Temporarily, just use hardcoded pathnames on tml's machine to make debugging the JS easier.
            _iWebView2.CoreWebView2.Navigate("file:///C:/Users/tml/lo/online-gitlab-coda25-coda/browser/dist/cool.html?file_path=" + _fileURL + "&closebutton=1&permission=edit&lang=en-US&appdocid=" + _appDocId + "&userinterfacemode=notebookbar&dir=ltr");

            _iWebView2.CoreWebView2.NewWindowRequested += delegate (
                object webview2, CoreWebView2NewWindowRequestedEventArgs args)
                {
                    ProcessStartInfo startInfo = new ProcessStartInfo
                    {
                        FileName = args.Uri,
                        // Open the URI in the default browser.
                        UseShellExecute = true
                    };
                    Process.Start(startInfo);
                    args.Handled = true;
                };
        }

        void WebView_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (e.IsSuccess)
                _iWebView2.CoreWebView2.Navigate("about:blank");
            else
                MessageBox.Show($"WebView2 creation failed with exception = {e.InitializationException}");
        }

        private bool _isMessageOfType(byte[] message, string type, int lengthOfMessage)
        {
            if (message.Length < type.Length + 2)
                return false;
            for (int i = 0; i < type.Length; i++)
                if (message[i] != type[i])
                    return false;
            return true;
        }

        void send2JS(IntPtr buffer, int length)
        {
            byte[] s = new byte[length];
            Marshal.Copy(buffer, s, 0, length);
            bool binaryMessage = (_isMessageOfType(s, "tile:", length) ||
                                  _isMessageOfType(s, "tilecombine:", length) ||
                                  _isMessageOfType(s, "delta:", length) ||
                                  _isMessageOfType(s, "renderfont:", length) ||
                                  _isMessageOfType(s, "rendersearchlist:", length) ||
                                  _isMessageOfType(s, "windowpaint:", length));

            string pretext = binaryMessage
                ? "window.TheFakeWebSocket.onmessage({'data': window.atob('"
                : "window.TheFakeWebSocket.onmessage({'data': window.b64d('";
            const string posttext = "')});";

            if (!binaryMessage)
            {
                StringBuilder sb = new StringBuilder(s.Length*2);

                for (int i = 0; i < (s.Length > 100 ? 100 : s.Length); i++)
                {
                    if (s[i] >= ' ' && s[i] < 127 && s[i] != '\\')
                        sb.Append((Char)s[i]);
                    else if (s[i] == '\\')
                        sb.Append("\\\\");
                    else if (s[i] == '\n')
                        sb.Append("\\n");
                    else
                    {
                        string hex = "0123456789abcdef";
                        sb.Append("\\" + hex[s[i] >> 4] + hex[s[i] & 0x0F]);
                    }
                }
                string subs = sb.ToString();
                if (sb.Length > 100)
                    subs += "...";
                Debug.WriteLine($"Evaluating JavaScript: {subs}");
            }

            string js = pretext + System.Convert.ToBase64String(s) + posttext;

            if (binaryMessage)
            {
                string subjs = js.Substring(0, (js.Length > 100 ? 100 : js.Length));
                if (js.Length > 100)
                    subjs += "...";
                Debug.WriteLine($"Evaluating JavaScript: {subjs}");
            }

            Application.Current.Dispatcher.Invoke(new Action(() => {
                _iWebView2.ExecuteScriptAsync(js);
            }));
        }

        void UpdateTitle()
        {
            this.Title = $"{GetDocumentTitle()}";
        }

        string GetDocumentTitle()
        {
            return _iWebView2?.CoreWebView2?.DocumentTitle ?? string.Empty;
        }

    }
}
