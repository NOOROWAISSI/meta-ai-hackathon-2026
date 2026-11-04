using System.Net;
using System.Net.Sockets;

namespace NextStep.Api;

// Resolve once, reject mixed/private answers, and connect to the checked IP directly.
// TLS still authenticates the original host through SocketsHttpHandler.
public static class PublicSourceConnection
{
    public static bool IsPublic(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        var b = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetwork) {
            return !(b[0] is 0 or 10 or 127 || b[0] >= 224 ||
                b[0] == 100 && b[1] is >= 64 and <= 127 ||
                b[0] == 169 && b[1] == 254 || b[0] == 172 && b[1] is >= 16 and <= 31 ||
                b[0] == 192 && (b[1] is 0 or 168 || b[1] == 2) ||
                b[0] == 198 && (b[1] is 18 or 19 || b[1] == 51 && b[2] == 100) ||
                b[0] == 203 && b[1] == 0 && b[2] == 113);
        }
        // Only ordinary global unicast; exclude special transition/documentation ranges.
        return address.AddressFamily == AddressFamily.InterNetworkV6 && (b[0] & 0xe0) == 0x20 &&
            !(b[0] == 0x20 && b[1] == 0x01 && (b[2] < 2 || b[2] == 0x0d && b[3] == 0xb8)) &&
            !(b[0] == 0x20 && b[1] == 0x02) && !(b[0] == 0x3f && b[1] == 0xff && (b[2] & 0xf0) == 0);
    }

    internal static async ValueTask<Stream> Connect(SocketsHttpConnectionContext context, CancellationToken ct)
        => await Connect(context.DnsEndPoint, (host, token) => Dns.GetHostAddressesAsync(host, token), Open, ct);

    internal static async Task<Stream> Connect(DnsEndPoint endpoint,
        Func<string, CancellationToken, Task<IPAddress[]>> resolve,
        Func<IPAddress, int, CancellationToken, Task<Stream>> open, CancellationToken ct)
    {
        if (endpoint.Port != 443) throw new HttpRequestException("Source connection requires HTTPS on the standard port.");
        var addresses = await resolve(endpoint.Host, ct);
        if (addresses.Length == 0 || addresses.Any(address => !IsPublic(address)))
            throw new HttpRequestException("Source DNS does not resolve exclusively to public addresses.");
        foreach (var address in addresses) {
            try { return await open(address, endpoint.Port, ct); }
            catch (SocketException) { }
        }
        throw new HttpRequestException("No public source address could be reached.");
    }
    private static async Task<Stream> Open(IPAddress address, int port, CancellationToken ct)
    {
        var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
        try { await socket.ConnectAsync(new IPEndPoint(address, port), ct); return new NetworkStream(socket, ownsSocket: true); }
        catch { socket.Dispose(); throw; }
    }
}
