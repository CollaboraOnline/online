// -*- tab-width: 4; indent-tabs-mode: nil; fill-column: 100 -*-

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace CODA
{
    public partial class MainWindow : Window
    {
        // FIXME: Is there some clever way to not have to duplicate the POLL* and struct pollfd
        // definitions for the C# and C++ parts of CODA-W?
        const int POLLIN = 0x001;
        const int POLLPRI = 0x002;
        const int POLLOUT = 0x004;
        const int POLLERR = 0x008;
        const int POLLHUP = 0x010;
        const int POLLNVAL = 0x020;

        public struct pollfd {
            public int fd;
            public short events;
            public short revents;
        };

        private IWebView2 _iWebView2;

        private bool _isNavigating = false;

        private int _fakeClientFd;

        private int[] _closeNotificationPipeForForwardingThread = new int[2];

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int get_coolwsd_server_socket_fd();

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int set_coolwsd_server_socket_fd(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketSocket();
        
        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketPipe2(int[] pipefds);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketPoll(pollfd[] fds, int nfds, int timeout);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketListen(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketConnect(int fd1, int fd2);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketAccept4(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern int fakeSocketPeer(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern long fakeSocketAvailableDataLength(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern long fakeSocketRead(int fd, byte[] buf, long nbytes);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern long fakeSocketWrite(int fd, byte[] buf, long nbytes);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern long fakeSocketShutdown(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern long fakeSocketClose(int fd);

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern long fakeSocketDumpState();

        [DllImport("CODALib.dll", CharSet = CharSet.Unicode)]
        public static extern void initialize_cpp_things();

        private CoreWebView2Settings _webViewSettings;
        CoreWebView2Settings WebViewSettings
        {
            get
            {
                if (_webViewSettings == null && _iWebView2?.CoreWebView2 != null)
                {
                    _webViewSettings = _iWebView2.CoreWebView2.Settings;
                }
                return _webViewSettings;
            }
        }

        CoreWebView2Environment _webViewEnvironment;
        CoreWebView2Environment WebViewEnvironment
        {
            get
            {
                if (_webViewEnvironment == null && _iWebView2?.CoreWebView2 != null)
                {
                    _webViewEnvironment = _iWebView2.CoreWebView2.Environment;
                }
                return _webViewEnvironment;
            }
        }

        CoreWebView2Profile _webViewProfile;
        CoreWebView2Profile WebViewProfile
        {
            get
            {
                if (_webViewProfile == null && _iWebView2?.CoreWebView2 != null)
                {
                    _webViewProfile = _iWebView2.CoreWebView2.Profile;
                }
                return _webViewProfile;
            }
        }

        public MainWindow()
        {
            Loaded += MainWindow_Loaded;
            InitializeComponent();
            initialize_cpp_things();
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            SetWebView(webView2XamlElement);
            await InitializeWebView(webView2XamlElement);
            _iWebView2.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
        }

        void WebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            Debug.WriteLine($"WebView_WebMessageReceived: {args.WebMessageAsJson}");

            if (args.WebMessageAsJson == "\"HULLO\"")
            {
                Debug.Assert(get_coolwsd_server_socket_fd() != -1);
                _fakeClientFd = fakeSocketSocket();

                int rc = fakeSocketConnect(_fakeClientFd, get_coolwsd_server_socket_fd());
                Debug.Assert(rc != -1);

                fakeSocketPipe2(_closeNotificationPipeForForwardingThread);

                // Start a thread to read responses and forward them to the JavaScript.

                Task.Run(() =>
                {
                    while (true)
                    {
                        var p = new pollfd[2];
                        p[0].fd = _fakeClientFd;
                        p[0].events = POLLIN;
                        p[1].fd = _closeNotificationPipeForForwardingThread[1];
                        p[1].events = POLLIN;
                        if (fakeSocketPoll(p, 2, -1) > 0)
                        {
                            if (p[1].revents == POLLIN)
                            {
                                // The code below handling the "BYE" fake Websocket message has
                                // closed the other end of the
                                // closeNotificationPipeForForwardingThread. Let's close the
                                // other end too just for cleanliness, even if a FakeSocket as
                                // such is not a system resource so nothing is saved by closing
                                // it.
                                fakeSocketClose(_closeNotificationPipeForForwardingThread[1]);

                                // Close our end of the fake socket connection to the
                                // ClientSession thread, so that it terminates
                                fakeSocketClose(_fakeClientFd);

                                return;
                            }
                            if (p[0].revents == POLLIN)
                            {
                                long n = fakeSocketAvailableDataLength(_fakeClientFd);
                                // I don't want to check for n being -1 here, even if that will
                                // lead to a crash, as n being -1 is a sign of something being
                                // wrong elsewhere anyway, and I prefer to fix the root cause.
                                // Let's see how well this works out.
                                if (n == 0)
                                    return;
                                var buf = new byte[n];
                                n = fakeSocketRead(_fakeClientFd, buf, n);
                                send2JS(buf, n);
                            }
                        }
                        else
                        {
                            break;
                        }
                    }
                    Debug.Assert(false);
                });
            }
        }

        private void SetWebView(IWebView2 newWebView2)
        {
			webView2XamlElement = newWebView2 as WebView2;
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
            Debug.WriteLine($"CoreWebView2_NavigationStarting: NavigationKind({kind})");
        }

        void WebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            _isNavigating = false;
        }

        Action OnWebViewFirstInitialized;

        void WebView_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            IWebView2 webView = sender as IWebView2;
            if (e.IsSuccess)
            {
                // FIXME: Temporarily when running from <repo>/windows/coda/CODA/bin/Debug.
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping("appassets", "..\\..\\..\\..\\..\\browser\\dist", CoreWebView2HostResourceAccessKind.DenyCors);
                webView.CoreWebView2.Navigate("https://appassets/cool.html?file_path=file:///C:/Users/tml/Sailing%20Yacht.odt&closebutton=1&permission=edit&appdocid=1&userinterfacemode=notebookbar&dir=ltr");

                OnWebViewFirstInitialized?.Invoke();

                webView.CoreWebView2.NewWindowRequested += delegate (
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
                return;
            }

            MessageBox.Show($"WebView2 creation failed with exception = {e.InitializationException}");
        }

        private bool _isMessageOfType(byte[] message, string type, long lengthOfMessage)
        {
            int typeLen = type.Length;
            return message.SequenceEqual(System.Text.Encoding.UTF8.GetBytes(type));
        }

        void send2JS(byte[] buffer, long length)
        {
            bool binaryMessage = (_isMessageOfType(buffer, "tile:", length) ||
                                           _isMessageOfType(buffer, "tilecombine:", length) ||
                                           _isMessageOfType(buffer, "delta:", length) ||
                                           _isMessageOfType(buffer, "renderfont:", length) ||
                                           _isMessageOfType(buffer, "rendersearchlist:", length) ||
                                           _isMessageOfType(buffer, "windowpaint:", length));

            string pretext = binaryMessage
                ? "window.TheFakeWebSocket.onmessage({'data': window.atob('"
                : "window.TheFakeWebSocket.onmessage({'data': window.b64d('";
            const string posttext = "')});";

            string js = pretext + System.Convert.ToBase64String(buffer) + posttext;

            _iWebView2.ExecuteScriptAsync(js);
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
