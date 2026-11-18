import type { SeedModule } from './types.js';

export const NETWORKS_MODULES: SeedModule[] = [
  {
    title: 'Foundations and the Network Layer',
    description: 'The layered architecture of networks, IPv4 addressing and subnetting, and how routers choose paths.',
    lessons: [
      {
        title: 'Layered Architecture: OSI and TCP/IP',
        topic: 'OSI and TCP/IP Models',
        durationMin: 35,
        content: `# Layered Architecture: OSI and TCP/IP

Networks are built in **layers**. Each layer offers a service to the layer above, uses the service of the layer below, and talks to its peer on the other machine through a **protocol**. Layering lets one layer change (say, Wi-Fi replacing Ethernet) without rewriting the others.

## The OSI reference model

| No. | Layer | Main job | Data unit | Examples |
|---|---|---|---|---|
| 7 | Application | Services for user programs | Data | HTTP, DNS, SMTP |
| 6 | Presentation | Encoding, compression, encryption | Data | TLS, JPEG |
| 5 | Session | Opening, managing and closing dialogues | Data | RPC session control |
| 4 | Transport | Process-to-process delivery, reliability | Segment | TCP, UDP |
| 3 | Network | Logical addressing and routing between networks | Packet (datagram) | IP, ICMP |
| 2 | Data link | Node-to-node delivery, framing, MAC addressing | Frame | Ethernet, Wi-Fi |
| 1 | Physical | Transmitting raw bits over a medium | Bit | Cables, radio |

A common memory aid, from layer 7 down to layer 1, is "All People Seem To Need Data Processing".

## The TCP/IP model

The Internet uses a simpler four-layer model.

| TCP/IP layer | Corresponding OSI layers |
|---|---|
| Application | Application, Presentation, Session |
| Transport | Transport |
| Internet | Network |
| Network access (link) | Data link, Physical |

## Encapsulation

On the sender, each layer adds its own header to the data handed down from above:

\`\`\`text
Application data
  -> [TCP header | data]                       segment
  -> [IP header | TCP header | data]           packet
  -> [Eth header | IP | TCP | data | trailer]  frame
  -> bits on the wire
\`\`\`

The receiver removes the headers in the reverse order (decapsulation). A router only looks as far as the IP header; a switch only looks at the frame header.

## Devices and addresses by layer

| Layer | Device | Address used |
|---|---|---|
| Physical | Hub, repeater | None |
| Data link | Switch, bridge | MAC address (48 bits) |
| Network | Router | IP address (32 bits in IPv4, 128 bits in IPv6) |
| Transport | End hosts | Port number (16 bits) |

### Worked example

A browser on a laptop requests a page from a server three routers away.

- The **port numbers** and the **IP addresses** stay the same from source to destination.
- The **MAC addresses** are rewritten at every hop: each frame carries the address of the next router, not of the final server.
- The frame is therefore created and destroyed four times: on the laptop's link and once on each link between routers and the server.

## Exam tips

- Reliability can exist at more than one layer: the data link layer is hop-to-hop, the transport layer is end-to-end.
- Routing is a network-layer function; switching inside a LAN is a data-link function.
- Error detection with a CRC is done in the data link layer trailer; TCP and UDP carry their own checksum as well.
- OSI is a reference model that is taught; TCP/IP is the protocol suite that is actually deployed.
- A hub repeats bits to every port and creates one collision domain; a switch forwards frames by MAC address and gives each port its own collision domain; a router separates broadcast domains.`,
      },
      {
        title: 'IPv4 Addressing and Subnetting',
        topic: 'IP Addressing and Subnetting',
        durationMin: 50,
        content: `# IPv4 Addressing and Subnetting

An IPv4 address is 32 bits, written as four decimal octets such as 192.168.10.77. It has a **network part** and a **host part**. In CIDR notation the prefix length after the slash says how many leading bits form the network part: /26 means 26 network bits and 6 host bits.

## Key formulas

- Subnet mask: prefix-length ones followed by zeros. /26 is 255.255.255.192.
- Addresses in a block = 2 to the power (32 - prefix).
- Usable hosts = that number minus 2, because the first address is the **network address** and the last is the **broadcast address**.
- Block size in the interesting octet = 256 - mask value in that octet.

| Prefix | Mask | Addresses | Usable hosts |
|---|---|---|---|
| /24 | 255.255.255.0 | 256 | 254 |
| /25 | 255.255.255.128 | 128 | 126 |
| /26 | 255.255.255.192 | 64 | 62 |
| /27 | 255.255.255.224 | 32 | 30 |
| /28 | 255.255.255.240 | 16 | 14 |
| /30 | 255.255.255.252 | 4 | 2 |

## Worked example 1: splitting a /24

Divide 192.168.10.0/24 into 4 equal subnets. Four subnets need 2 extra bits, so the new prefix is /26 and the block size is 64.

| Subnet | Network | Usable range | Broadcast |
|---|---|---|---|
| 1 | 192.168.10.0 | .1 to .62 | 192.168.10.63 |
| 2 | 192.168.10.64 | .65 to .126 | 192.168.10.127 |
| 3 | 192.168.10.128 | .129 to .190 | 192.168.10.191 |
| 4 | 192.168.10.192 | .193 to .254 | 192.168.10.255 |

The host 192.168.10.77/26 lies in subnet 2: 77 falls between 64 and 127.

## Worked example 2: a prefix inside an octet

Find the network and broadcast addresses of 172.16.45.200/20.

- The mask is 255.255.240.0, so the interesting octet is the third and the block size is 256 - 240 = 16.
- Multiples of 16: 0, 16, 32, 48. The value 45 falls in the block starting at 32.
- Network address: **172.16.32.0**. Broadcast address: **172.16.47.255**.
- Usable hosts: 2 to the power 12, minus 2 = **4094**.

## Worked example 3: VLSM

From 192.168.1.0/24, allocate subnets for 100, 50 and 20 hosts. Always serve the largest need first.

- 100 hosts need 7 host bits (126 usable): 192.168.1.0/25
- 50 hosts need 6 host bits (62 usable): 192.168.1.128/26
- 20 hosts need 5 host bits (30 usable): 192.168.1.192/27

The range 192.168.1.224 to 192.168.1.255 remains free for later use.

## Private address ranges

10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16 are not routed on the public Internet; hosts using them reach the Internet through **NAT**. The block 127.0.0.0/8 is loopback.

## Common mistakes

- Forgetting to subtract 2 when counting hosts. A /30 has four addresses but only two hosts, which is why it is used for point-to-point links.
- Confusing the number of subnets with the number of hosts. Borrowed bits create subnets; remaining bits create hosts.
- Assigning the network or broadcast address to a device.
- Choosing a subnet that is exactly the size of the requirement: 30 hosts fit in a /27, but 31 hosts need a /26.`,
      },
      {
        title: 'Routing: Distance Vector and Link State',
        topic: 'Routing Algorithms',
        durationMin: 45,
        content: `# Routing: Distance Vector and Link State

**Forwarding** is the per-packet action of moving a packet from an input port to the right output port using the forwarding table. **Routing** is the network-wide process that computes those tables. Routing algorithms fall into two families.

## Distance vector

Each router knows only the cost to its direct neighbours and the distance vectors its neighbours advertise. It applies the **Bellman-Ford equation**:

\`\`\`text
D(x, y) = minimum over all neighbours v of [ cost(x, v) + D(v, y) ]
\`\`\`

Routers exchange vectors periodically and whenever a distance changes. RIP is the classic protocol: its metric is hop count, the maximum is 15 hops and 16 means unreachable.

### Worked example

Router A has neighbours B (link cost 2) and C (link cost 7). B advertises distance 3 to D and distance 1 to C. C advertises distance 1 to D.

- Cost from A to D = min(2 + 3, 7 + 1) = min(5, 8) = **5**, with next hop B.
- Cost from A to C = min(7 directly, 2 + 1 through B) = **3**, with next hop B.

### Count to infinity

Good news travels fast, bad news travels slowly. If a link fails, two routers can keep advertising a stale route to each other, raising the cost one step per exchange until it reaches infinity. Partial remedies:

- **Split horizon**: do not advertise a route back to the neighbour it was learned from.
- **Poison reverse**: advertise it back with infinite cost.

## Link state

Each router floods a **link-state advertisement** describing its own links to the entire area. Every router therefore holds the same map of the network and runs **Dijkstra's algorithm** to build a shortest-path tree with itself as the root. OSPF and IS-IS work this way. OSPF uses a cost based on link bandwidth and divides large networks into areas connected through a backbone, area 0.

## Comparison

| Feature | Distance vector | Link state |
|---|---|---|
| Knowledge | Neighbours' distance tables only | Full topology |
| Algorithm | Bellman-Ford | Dijkstra |
| Messages | Vectors sent to neighbours | Link states flooded to all routers |
| Convergence | Slow; count-to-infinity possible | Fast |
| CPU and memory use | Low | Higher |
| Protocols | RIP | OSPF, IS-IS |

Between autonomous systems the Internet uses **BGP**, a **path-vector** protocol: it advertises the full list of autonomous systems on a path, which makes loops easy to detect and lets operators apply policy.

## Longest prefix match

When several forwarding-table entries match a destination, the router chooses the most specific one, the entry with the longest prefix.

| Prefix | Interface |
|---|---|
| 10.1.0.0/16 | 1 |
| 10.1.2.0/24 | 2 |
| 0.0.0.0/0 (default) | 3 |

A packet for 10.1.2.9 matches all three entries and leaves through interface 2. A packet for 10.1.7.4 uses interface 1, and a packet for 8.8.8.8 uses the default route.

## Common mistakes

- Saying link-state routers exchange routing tables. They exchange link states; each router computes its own table.
- Assuming split horizon cures count to infinity completely. It fails for loops involving three or more routers.
- Confusing routing with forwarding: the routing protocol fills the table, forwarding only consults it.
- Applying Dijkstra to a graph with negative link costs; it assumes costs are non-negative.`,
      },
    ],
  },
  {
    title: 'Transport Layer',
    description: 'Process-to-process delivery with UDP and TCP: ports, connection management, flow control and congestion control.',
    lessons: [
      {
        title: 'UDP, Ports and Multiplexing',
        topic: 'UDP and Multiplexing',
        durationMin: 35,
        content: `# UDP, Ports and Multiplexing

The network layer delivers packets from host to host. The **transport layer** extends this to delivery from **process to process**, using port numbers to tell applications on the same host apart.

## Port numbers

A port is a 16-bit number, so values range from 0 to 65535.

| Range | Name | Use |
|---|---|---|
| 0 to 1023 | Well-known ports | Standard services: 53 DNS, 80 HTTP, 443 HTTPS, 25 SMTP, 22 SSH |
| 1024 to 49151 | Registered ports | Assigned to particular applications |
| 49152 to 65535 | Dynamic (ephemeral) ports | Chosen temporarily by clients |

## Multiplexing and demultiplexing

**Multiplexing** at the sender gathers data from several sockets and adds a transport header. **Demultiplexing** at the receiver uses the header fields to hand each segment to the right socket.

- A **UDP socket** is identified by a 2-tuple: destination IP address and destination port. Datagrams from different senders to the same port reach the same socket.
- A **TCP connection** is identified by a 4-tuple: source IP, source port, destination IP, destination port. A web server therefore has a separate socket for every client, even though all of them use port 443.

## UDP

The User Datagram Protocol adds almost nothing to IP: it is **connectionless** and **unreliable**. There is no handshake, no acknowledgement, no retransmission, no ordering, no flow control and no congestion control.

The UDP header is only **8 bytes**, made of four 16-bit fields:

\`\`\`text
| source port | destination port |
| length      | checksum         |
\`\`\`

The length field covers the header plus the data, so its minimum value is 8. Over IPv4 the largest possible UDP payload is 65,535 - 20 (IP header) - 8 (UDP header) = 65,507 bytes.

### Worked example: the checksum

The sender treats the segment as a sequence of 16-bit words, adds them using one's-complement arithmetic (any carry out of the top bit is wrapped around and added back), and stores the complement of the sum.

\`\`\`text
  1110 0110 0110 0110
+ 1101 0101 0101 0101
---------------------
1 1011 1011 1011 1011      carry out of the top bit
  1011 1011 1011 1100      after wrapping the carry around
  0100 0100 0100 0011      checksum = one's complement of the sum
\`\`\`

The receiver adds all the words including the checksum. If the result is not all ones, an error has been detected. The checksum also covers a **pseudo-header** containing the IP addresses, which catches misdelivered datagrams. It is optional in IPv4 and mandatory in IPv6.

## When UDP is the right choice

- Short request-response exchanges where a handshake would double the delay: DNS, DHCP.
- Real-time media such as voice and video calls, where a late packet is useless and retransmission does not help.
- Protocols that build their own reliability in the application, such as QUIC, the basis of HTTP/3.

## Common mistakes

- Calling UDP "error free" because it has a checksum. It can detect errors but does not correct them; a damaged datagram is simply discarded.
- Stating that UDP has a 20-byte header. That is the minimum TCP header; UDP's is 8 bytes.
- Assuming port numbers identify hosts. The IP address identifies the host; the port identifies the process.
- Forgetting that an application using UDP must tolerate loss, duplication and reordering itself.`,
      },
      {
        title: 'TCP Connection Management',
        topic: 'TCP Connection Management',
        durationMin: 45,
        content: `# TCP Connection Management

TCP provides a **reliable, ordered byte stream** between two processes. Before any data flows, both ends must agree on starting sequence numbers; when they finish, each direction is closed separately.

## Fields that matter

- **Sequence number**: the number of the first data byte in this segment.
- **Acknowledgement number**: the next byte the sender of the ACK expects. Acknowledgements are **cumulative**.
- **Flags**: SYN (synchronise), ACK, FIN (finish), RST (reset).
- **Window**: how many bytes the receiver is willing to accept.

The minimum TCP header is **20 bytes**; options can extend it to 60 bytes.

## Three-way handshake

Suppose the client chooses the initial sequence number (ISN) 1000 and the server chooses 5000.

| Step | Direction | Flags | Seq | Ack |
|---|---|---|---|---|
| 1 | Client -> Server | SYN | 1000 | - |
| 2 | Server -> Client | SYN, ACK | 5000 | 1001 |
| 3 | Client -> Server | ACK | 1001 | 5001 |

A SYN carries no data but **consumes one sequence number**, which is why the acknowledgements are 1001 and 5001. The third segment may already carry data.

### Worked example: data transfer

After the handshake the client sends 200 bytes. The segment has Seq = 1001 and holds bytes 1001 to 1200. The server replies with Ack = **1201**, the next byte it expects. If the client then sends 300 more bytes (Seq = 1201), the acknowledgement becomes 1501.

## Why three steps and not two?

Each side must learn that the other has received its ISN. With only two steps the server could not tell whether its SYN-ACK arrived, and an old, delayed SYN from an earlier connection could open a connection the client never wanted. The third segment confirms that the client is live and has the server's sequence number.

## Closing a connection

Closing normally takes **four segments**, because each direction is shut down independently:

1. Client sends FIN.
2. Server sends ACK. The connection is now **half-closed**: the server may still send data.
3. Server sends FIN when it has finished.
4. Client sends ACK.

A FIN also consumes one sequence number. After the last ACK, the side that closed first waits in the **TIME-WAIT** state for twice the maximum segment lifetime (2 MSL). The wait lets it resend the final ACK if it was lost and lets stray segments from the old connection die out.

## Connection states

Client side: CLOSED, SYN-SENT, ESTABLISHED, FIN-WAIT-1, FIN-WAIT-2, TIME-WAIT, CLOSED.

Server side: CLOSED, LISTEN, SYN-RECEIVED, ESTABLISHED, CLOSE-WAIT, LAST-ACK, CLOSED.

## Abnormal cases

- **RST** aborts a connection immediately, for example when a segment arrives for a port on which nothing is listening.
- **SYN flood**: an attacker sends many SYNs and never completes the handshake, filling the server's table of half-open connections. **SYN cookies** defend against it by encoding the connection state in the server's ISN instead of storing it.

## Common mistakes

- Writing the acknowledgement as the last byte received. It is the **next byte expected**.
- Forgetting that SYN and FIN each use up one sequence number although they carry no data.
- Saying termination is always a three-step exchange. The standard close uses four segments; steps 2 and 3 can be combined only when the server has nothing more to send.
- Confusing the ISN with zero. It is chosen unpredictably to protect against spoofed segments.`,
      },
      {
        title: 'TCP Flow Control and Congestion Control',
        topic: 'TCP Congestion Control',
        durationMin: 50,
        content: `# TCP Flow Control and Congestion Control

TCP limits its sending rate for two different reasons, and the two mechanisms are often confused.

| Mechanism | Protects | Variable | Who sets it |
|---|---|---|---|
| Flow control | The receiver's buffer | Receive window (rwnd) | Advertised by the receiver in every segment |
| Congestion control | The network | Congestion window (cwnd) | Estimated by the sender |

The sender may have at most **min(cwnd, rwnd)** unacknowledged bytes outstanding.

## Detecting loss

- **Timeout**: no acknowledgement arrives before the retransmission timer expires. This indicates serious congestion.
- **Three duplicate ACKs**: later segments are still arriving, so only one segment was probably lost. The sender performs a **fast retransmit** without waiting for the timer.

## The phases

1. **Slow start**: cwnd begins at 1 MSS and increases by 1 MSS for every ACK, which **doubles** it each round-trip time. Growth is exponential until cwnd reaches the threshold ssthresh.
2. **Congestion avoidance**: cwnd grows by about 1 MSS per round-trip time. Growth is linear (additive increase).
3. **Reaction to loss** (multiplicative decrease):

| Event | TCP Tahoe | TCP Reno |
|---|---|---|
| Timeout | ssthresh = cwnd / 2, cwnd = 1 MSS, slow start | Same as Tahoe |
| Three duplicate ACKs | ssthresh = cwnd / 2, cwnd = 1 MSS, slow start | ssthresh = cwnd / 2, cwnd = ssthresh, continue in congestion avoidance (**fast recovery**) |

The overall pattern is **AIMD**: additive increase, multiplicative decrease, which gives the familiar sawtooth graph of cwnd against time.

## Worked example

Initial cwnd = 1 MSS and ssthresh = 8 MSS.

| Round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| cwnd (MSS) | 1 | 2 | 4 | 8 | 9 | 10 | 11 | 12 |

Rounds 1 to 4 are slow start; from round 5 the sender is in congestion avoidance.

**Case A: three duplicate ACKs arrive when cwnd = 12 (Reno).**

- ssthresh = 12 / 2 = 6
- cwnd = 6, then 7, 8, 9 in the following rounds (linear growth).

**Case B: a timeout occurs when cwnd = 12.**

- ssthresh = 6 and cwnd = 1
- Slow start gives 1, 2, 4, then 6 (growth stops at ssthresh), and then 7, 8 in congestion avoidance.

## Flow control in detail

The receiver advertises rwnd = buffer size - data received but not yet read by the application. If rwnd becomes 0 the sender stops, but keeps sending 1-byte **window probes** so that it learns when space opens up; otherwise a lost window update would block the connection forever.

## Fairness and modern variants

AIMD makes competing TCP flows converge towards an equal share of a bottleneck link. Newer algorithms change how cwnd grows: **CUBIC**, the default in Linux, uses a cubic function of the time since the last loss, and **BBR** estimates bottleneck bandwidth and round-trip time instead of waiting for loss.

## Common mistakes

- Thinking slow start is slow. It doubles the window every round-trip time; it is slow only compared with sending everything at once.
- Using the same reaction for both loss signals in Reno. A timeout resets cwnd to 1 MSS; three duplicate ACKs only halve it.
- Confusing rwnd with cwnd. The receiver advertises rwnd; cwnd never appears in any header.
- Forgetting to update ssthresh on a loss. It always becomes half of the cwnd at the moment of loss.`,
      },
    ],
  },
  {
    title: 'Application Layer and Security',
    description: 'How names are resolved with DNS, how the web works over HTTP, and how TLS secures the connection.',
    lessons: [
      {
        title: 'DNS: Resolving Names to Addresses',
        topic: 'DNS',
        durationMin: 40,
        content: `# DNS: Resolving Names to Addresses

People use names such as www.meridian.example; routers need IP addresses. The **Domain Name System** is a distributed, hierarchical database that translates between the two. No single server knows every name; responsibility is delegated down a tree.

## The hierarchy

| Level | Role |
|---|---|
| Root servers | Know the name servers of every top-level domain. There are 13 root server names, a to m, each served by many machines using anycast |
| TLD servers | Responsible for one top-level domain (.in, .org, .example) and know the authoritative servers of each domain under it |
| Authoritative servers | Hold the actual records of a zone such as meridian.example |
| Recursive resolver | Run by an ISP, a campus or a public provider; performs the lookup on behalf of clients and caches the answers |

## Worked example: resolving www.meridian.example

1. The browser asks the operating system's **stub resolver**, which sends a **recursive** query to the configured resolver.
2. The resolver has nothing cached, so it asks a **root server**. The root replies with a referral to the .example TLD servers.
3. The resolver asks a **TLD server**, which refers it to the authoritative name servers of meridian.example.
4. The resolver asks the **authoritative server**, which returns the A record with the IPv4 address.
5. The resolver caches the answer for the record's **TTL** and returns it to the client.

Steps 2 to 4 are **iterative** queries: each server answers with the best referral it has and the resolver does the legwork. The client's own query is recursive: it expects a final answer. A cold lookup therefore needs four query-response exchanges; a warm cache needs one.

## Resource records

| Type | Meaning |
|---|---|
| A | Name to IPv4 address |
| AAAA | Name to IPv6 address |
| CNAME | Alias: this name is another name for the canonical name |
| MX | Mail server for the domain, with a preference value (lower is preferred) |
| NS | Authoritative name server for the zone |
| PTR | Reverse lookup: address to name |
| SOA | Start of authority: zone serial number and timers |
| TXT | Free text, used for SPF and domain verification |

## Transport

DNS normally uses **UDP port 53**, because one small request and one small response do not justify a handshake. It switches to **TCP port 53** when a response is too large (the server sets the truncated bit and the client retries) and for zone transfers between servers.

## Caching and TTL

Every record carries a time to live in seconds. A long TTL reduces load and speeds up lookups; a short TTL lets changes spread quickly. Resolvers also cache negative answers (name does not exist) for a limited time.

## Common mistakes

- Saying the root server returns the final IP address. It returns only a referral to the TLD servers.
- Believing DNS never uses TCP. Large responses and zone transfers do.
- Placing a CNAME on a name that also has other records. A name with a CNAME may not have any other record type, which is why the zone apex cannot be a CNAME.
- Expecting a DNS change to be visible at once. Old answers remain in caches until their TTL expires.
- Confusing the resolver with the authoritative server: the resolver asks questions and caches; the authoritative server owns the data.`,
      },
      {
        title: 'HTTP and the Web',
        topic: 'HTTP',
        durationMin: 40,
        content: `# HTTP and the Web

The HyperText Transfer Protocol is a **request-response** protocol: a client sends a request and the server returns a response. HTTP itself is **stateless**; the server does not remember earlier requests unless the application adds state with cookies or tokens.

## A request and a response

\`\`\`text
GET /courses/cs303 HTTP/1.1
Host: www.meridian.example
Accept: text/html

HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 5120
Cache-Control: max-age=3600
\`\`\`

## Methods

| Method | Purpose | Safe | Idempotent |
|---|---|---|---|
| GET | Read a resource | Yes | Yes |
| HEAD | Like GET but headers only | Yes | Yes |
| POST | Create a resource or trigger processing | No | No |
| PUT | Replace a resource completely | No | Yes |
| PATCH | Modify part of a resource | No | Not necessarily |
| DELETE | Remove a resource | No | Yes |

**Safe** means the request does not change server state. **Idempotent** means repeating the request has the same effect as sending it once, so it can be retried after a network failure.

## Status codes

| Class | Meaning | Common codes |
|---|---|---|
| 1xx | Informational | 101 Switching Protocols |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirection | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| 5xx | Server error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable |

401 means the client has not authenticated; 403 means it is authenticated but not permitted.

## Connections

- **Non-persistent** (HTTP/1.0): a new TCP connection for every object.
- **Persistent** (default in HTTP/1.1): several requests reuse one connection.
- **HTTP/2**: one connection carries many **multiplexed** streams, in a binary format with compressed headers.
- **HTTP/3**: runs over **QUIC**, which uses UDP, so one lost packet does not stall the other streams.

### Worked example: counting round trips

A page consists of a base HTML file and 10 images on the same server. Ignore transmission time and count round-trip times (RTT). Opening a TCP connection costs 1 RTT and each request-response costs 1 RTT.

- Non-persistent, one connection at a time: 11 objects x 2 RTT = **22 RTT**.
- Persistent without pipelining: 1 RTT to connect + 11 requests = **12 RTT**.
- Persistent with pipelining: 1 RTT to connect + 1 for the HTML + 1 for all the images = **3 RTT**.

## Caching

The server tells clients how long a response may be reused with Cache-Control. A cached copy can be revalidated cheaply: the client sends the stored **ETag** in an If-None-Match header, and the server replies **304 Not Modified** with no body if nothing has changed.

## Cookies

The server sends a Set-Cookie header; the browser returns the value in the Cookie header of later requests to that site. Cookies carry session identifiers and should be marked HttpOnly and Secure.

## Common mistakes

- Calling POST idempotent. Repeating a POST may create two orders.
- Mixing up 401 and 403, or 301 (permanent) and 302 (temporary).
- Describing HTTP as stateful because of cookies. The protocol is stateless; cookies are how applications add state on top.
- Assuming HTTP/2 needs several connections for parallel downloads. One connection is enough.`,
      },
      {
        title: 'TLS and HTTPS',
        topic: 'TLS and HTTPS',
        durationMin: 45,
        content: `# TLS and HTTPS

HTTP sends everything in plain text. **HTTPS** is ordinary HTTP carried inside a **Transport Layer Security (TLS)** connection, normally on port 443. TLS sits between the application and TCP and provides three guarantees:

- **Confidentiality**: an eavesdropper cannot read the data.
- **Integrity**: any change to the data in transit is detected.
- **Authentication**: the client can verify it is talking to the genuine server.

## Two kinds of cryptography

| Kind | Keys | Speed | Used in TLS for |
|---|---|---|---|
| Symmetric (AES-GCM, ChaCha20-Poly1305) | One shared secret key | Fast | Encrypting the application data |
| Asymmetric (RSA, elliptic-curve) | A public key and a private key | Slow | Authenticating the server and agreeing on the shared key |

TLS uses the slow asymmetric operations only during the handshake, to establish **session keys**, and then switches to symmetric encryption.

## Certificates

A **certificate** binds a domain name to a public key and is signed by a **Certificate Authority (CA)**. The browser checks that:

1. the chain of signatures leads to a root CA it already trusts,
2. the current date lies within the validity period,
3. the name in the address bar matches a name in the certificate, and
4. the certificate has not been revoked.

The server proves it owns the matching private key by signing part of the handshake. A man in the middle cannot do this without the private key, so the attack fails.

## The TLS 1.3 handshake

\`\`\`text
Client                                      Server
ClientHello (versions, ciphers, key share) ->
                 <- ServerHello (key share)
                 <- Certificate, CertificateVerify, Finished   (encrypted)
Finished ->
Application data  <->  Application data
\`\`\`

Both sides combine their **ephemeral Diffie-Hellman** key shares to derive the same secret; the secret itself never crosses the network. Because the key shares are discarded afterwards, recording the traffic and stealing the server's private key later does not reveal past sessions. This property is **forward secrecy**. TLS 1.3 removed the older RSA key exchange precisely because it lacked it.

### Worked example: delay before the first response

Count round-trip times for a new HTTPS connection:

- TCP three-way handshake: 1 RTT
- TLS 1.3 handshake: 1 RTT
- HTTP request and response: 1 RTT

The first byte of the page arrives after **3 RTT**. With TLS 1.2 the handshake needs 2 RTT, giving 4 RTT in total. With a round-trip time of 80 ms, TLS 1.3 saves 80 ms on every new connection. Session resumption can reduce the cost further, and QUIC merges the transport and TLS handshakes into a single round trip.

## What TLS does not hide

- The IP addresses and port numbers of both ends.
- The server name, which is sent in the clear in the Server Name Indication field unless Encrypted Client Hello is used.
- The size and timing of the messages.

## Common mistakes

- Saying the page is encrypted with the server's public key. Bulk data is encrypted with symmetric session keys.
- Believing HTTPS proves a site is trustworthy. It proves only that the connection is private and that the server controls the domain.
- Ignoring certificate warnings; an invalid certificate is exactly what a man-in-the-middle attack looks like.
- Confusing encryption with integrity. Modern cipher suites are authenticated: they both encrypt and detect tampering.`,
      },
    ],
  },
];
