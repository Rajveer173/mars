import { fill, multi, single, subj, tf, type SeedQuestion } from './types.js';

// Order matters inside a lesson: the midterm takes the first two questions of
// every lesson, quizzes take the auto-graded ones in order.
const OSI = 'OSI and TCP/IP Models';
const IP = 'IP Addressing and Subnetting';
const ROUTING = 'Routing Algorithms';
const UDP = 'UDP and Multiplexing';
const TCP = 'TCP Connection Management';
const CC = 'TCP Congestion Control';
const DNS = 'DNS';
const HTTP = 'HTTP';
const TLS = 'TLS and HTTPS';

export const NETWORKS_QUESTIONS: SeedQuestion[] = [
  // --- OSI and TCP/IP Models
  single(OSI, 'EASY', 'REMEMBER', 'At which layer of the OSI model does a router primarily operate?',
    ['Data link', 'Network', 'Transport', 'Session'],
    1, 'Routers forward packets using IP addresses, a network-layer function. Switches work at the data link layer.', ['osi-model', 'devices']),
  tf(OSI, 'EASY', 'UNDERSTAND', 'As a packet crosses several routers, its MAC addresses stay the same while its IP addresses are rewritten at every hop.',
    false, 'It is the reverse: the frame (and its MAC addresses) is rebuilt on every link, while the source and destination IP addresses stay the same end to end.', ['osi-model', 'encapsulation']),
  single(OSI, 'MEDIUM', 'REMEMBER', 'Which list gives the data-unit names in order from the transport layer down to the physical layer?',
    ['Packet, segment, frame, bit', 'Frame, packet, segment, bit', 'Segment, packet, frame, bit', 'Segment, frame, packet, bit'],
    2, 'Transport: segment. Network: packet. Data link: frame. Physical: bit.', ['osi-model', 'pdu']),

  // --- IP Addressing and Subnetting
  single(IP, 'EASY', 'REMEMBER', 'How many usable host addresses does a /26 subnet provide?',
    ['30', '64', '126', '62'],
    3, 'A /26 has 6 host bits: 2^6 = 64 addresses, minus the network and broadcast addresses, leaves 62.', ['subnetting']),
  single(IP, 'MEDIUM', 'APPLY', 'What is the broadcast address of the subnet that contains the host 192.168.10.77/26?',
    ['192.168.10.63', '192.168.10.64', '192.168.10.255', '192.168.10.127'],
    3, 'The block size is 64, so the subnets start at 0, 64, 128 and 192. Address 77 is in 192.168.10.64/26, whose last address is 192.168.10.127.', ['subnetting']),
  single(IP, 'HARD', 'APPLY', 'What is the network address of 172.16.45.200/20?',
    ['172.16.45.0', '172.16.40.0', '172.16.32.0', '172.16.0.0'],
    2, 'The mask is 255.255.240.0, so the block size in the third octet is 16. The value 45 lies in the block 32 to 47, giving 172.16.32.0.', ['subnetting', 'cidr']),
  fill(IP, 'MEDIUM', 'APPLY', 'The smallest subnet that can hold 50 hosts has the prefix length /______.',
    ['26', '/26'], ['27', '25', '24'],
    '50 hosts need 6 host bits (2^6 - 2 = 62 usable addresses), so the prefix is 32 - 6 = 26. A /27 offers only 30 hosts.', ['subnetting', 'vlsm']),

  // --- Routing Algorithms
  single(ROUTING, 'MEDIUM', 'REMEMBER', 'Which algorithm does a link-state routing protocol such as OSPF run to compute shortest paths?',
    ['Bellman-Ford', 'Dijkstra', 'Floyd-Warshall', 'Kruskal'],
    1, 'Every link-state router holds the full topology and runs Dijkstra with itself as the root. Distance-vector protocols use Bellman-Ford.', ['routing', 'ospf']),
  single(ROUTING, 'MEDIUM', 'APPLY', 'Router A reaches neighbour B at cost 2 and neighbour C at cost 7. B advertises a distance of 3 to D, and C advertises a distance of 1 to D. What is A\'s distance to D, and through which next hop?',
    ['5 through B', '8 through C', '4 through C', '3 through B'],
    0, 'Bellman-Ford: min(2 + 3, 7 + 1) = min(5, 8) = 5, with B as the next hop.', ['routing', 'distance-vector']),
  single(ROUTING, 'MEDIUM', 'APPLY', 'A forwarding table contains 10.1.0.0/16 -> interface 1, 10.1.2.0/24 -> interface 2 and a default route -> interface 3. Which interface is used for a packet addressed to 10.1.2.9?',
    ['Interface 1', 'Interface 3', 'Interface 2', 'The packet is dropped'],
    2, 'All three entries match, and the router chooses the longest prefix: the /24 entry, interface 2.', ['routing', 'longest-prefix-match']),

  // --- UDP and Multiplexing
  single(UDP, 'EASY', 'REMEMBER', 'What is the size of the UDP header?',
    ['4 bytes', '8 bytes', '20 bytes', '32 bytes'],
    1, 'The UDP header has four 16-bit fields: source port, destination port, length and checksum, 8 bytes in all.', ['udp', 'transport-layer']),
  single(UDP, 'MEDIUM', 'UNDERSTAND', 'Which set of values identifies a TCP connection?',
    ['The destination port only', 'The destination IP address and destination port', 'The source and destination MAC addresses', 'The source IP, source port, destination IP and destination port'],
    3, 'A TCP connection is identified by the 4-tuple, which is why one server port can serve many clients. A UDP socket is identified by destination IP and port only.', ['multiplexing', 'transport-layer']),
  multi(UDP, 'MEDIUM', 'UNDERSTAND', 'Which of the following does UDP provide? Select all that apply.',
    ['Process-to-process delivery using port numbers', 'Error detection using a checksum', 'Retransmission of lost datagrams', 'Congestion control'],
    [0, 1], 'UDP adds only ports and a checksum to IP. It has no acknowledgements, retransmission, ordering, flow control or congestion control.', ['udp', 'transport-layer']),

  // --- TCP Connection Management
  single(TCP, 'MEDIUM', 'APPLY', 'A client sends a SYN with sequence number 1000. The server replies with a SYN-ACK whose sequence number is 5000. What acknowledgement number does the SYN-ACK carry?',
    ['1000', '5000', '1001', '5001'],
    2, 'A SYN consumes one sequence number, so the server acknowledges 1001, the next byte it expects from the client.', ['tcp', 'handshake', 'transport-layer']),
  subj(TCP, 'HARD', 'ANALYZE', 'Explain why TCP opens a connection with a three-way handshake rather than two segments. Then give the sequence and acknowledgement numbers of the three segments when the client\'s initial sequence number is 300 and the server\'s is 700.',
    'Model answer. Both sides must have their initial sequence number acknowledged. With two segments the server would not know that its SYN-ACK (and ISN) reached the client, and a delayed duplicate SYN from an old connection could create a connection the client never requested. Segments: (1) client SYN, seq = 300; (2) server SYN-ACK, seq = 700, ack = 301; (3) client ACK, seq = 301, ack = 701. Award 2 marks for the reasoning and 1 for each correct segment.',
    {
      good: 'Each side chooses its own initial sequence number and needs proof that the other side received it. After two segments the client knows the server got its SYN, but the server does not know whether its SYN-ACK arrived; the third segment confirms that. It also stops an old delayed SYN from opening a connection by mistake, because the client will not acknowledge a SYN-ACK it did not ask for. Segments: 1) client sends SYN, seq = 300. 2) server sends SYN+ACK, seq = 700, ack = 301. 3) client sends ACK, seq = 301, ack = 701.',
      partial: 'Three segments are needed so that both the client and the server agree to the connection. Client sends SYN seq = 300. Server sends SYN-ACK seq = 700, ack = 300. Client sends ACK with ack = 700.',
      weak: 'TCP uses three steps because it is reliable and UDP is not. The client sends 300, the server sends 700 and then data transfer starts.',
    }, ['tcp', 'handshake', 'transport-layer']),
  single(TCP, 'HARD', 'APPLY', 'After a handshake in which the client\'s initial sequence number was 1000, the client sends its first 200 bytes of data. What acknowledgement number does the server return?',
    ['1200', '1201', '1001', '1202'],
    1, 'The data occupies bytes 1001 to 1200 (the SYN used 1000), so the next byte expected is 1201.', ['tcp', 'sequence-numbers', 'transport-layer']),
  tf(TCP, 'MEDIUM', 'REMEMBER', 'A normal TCP connection close uses four segments because each direction of the connection is closed independently.',
    true, 'Each side sends its own FIN and receives an ACK. Between the two, the connection is half-closed.', ['tcp', 'termination', 'transport-layer']),

  // --- TCP Congestion Control
  single(CC, 'MEDIUM', 'UNDERSTAND', 'Which window is advertised by the receiver to stop the sender from overflowing the receiver\'s buffer?',
    ['Congestion window (cwnd)', 'Receive window (rwnd)', 'Slow-start threshold (ssthresh)', 'Maximum segment size (MSS)'],
    1, 'Flow control uses rwnd, sent in every TCP header. cwnd is the sender\'s own estimate of network capacity and is never transmitted.', ['tcp', 'flow-control', 'transport-layer']),
  single(CC, 'HARD', 'APPLY', 'A TCP Reno sender has cwnd = 12 MSS when it receives three duplicate ACKs. What are the new values of ssthresh and cwnd?',
    ['ssthresh = 6, cwnd = 1', 'ssthresh = 12, cwnd = 6', 'ssthresh = 6, cwnd = 6', 'ssthresh = 12, cwnd = 1'],
    2, 'Reno halves the window on three duplicate ACKs: ssthresh = cwnd / 2 = 6 and cwnd = ssthresh = 6 (fast recovery). cwnd drops to 1 only on a timeout.', ['tcp', 'congestion-control', 'transport-layer']),
  single(CC, 'EXPERT', 'ANALYZE', 'A TCP sender starts with cwnd = 1 MSS and ssthresh = 8 MSS and experiences no loss. What is cwnd in the 7th transmission round?',
    ['64 MSS', '11 MSS', '14 MSS', '32 MSS'],
    1, 'Slow start doubles the window up to ssthresh: 1, 2, 4, 8. Congestion avoidance then adds 1 MSS per round: 9, 10, 11. Round 7 has cwnd = 11.', ['tcp', 'congestion-control', 'transport-layer']),

  // --- DNS
  single(DNS, 'EASY', 'REMEMBER', 'Which DNS record type maps a domain name to an IPv6 address?',
    ['A', 'CNAME', 'AAAA', 'MX'],
    2, 'A records hold IPv4 addresses and AAAA records hold IPv6 addresses.', ['dns', 'application-layer']),
  fill(DNS, 'EASY', 'REMEMBER', 'DNS queries are normally sent over UDP to port ______.',
    ['53'], ['80', '443', '67'],
    'DNS uses port 53: UDP for ordinary queries, TCP for truncated responses and zone transfers.', ['dns', 'application-layer']),
  single(DNS, 'MEDIUM', 'UNDERSTAND', 'A recursive resolver with an empty cache asks a root server for www.meridian.example. What does the root server return?',
    ['The IPv4 address of www.meridian.example', 'An error, because root servers answer only for top-level domains', 'A referral to the name servers of the .example top-level domain', 'The address of the client\'s ISP resolver'],
    2, 'Root servers answer iteratively with a referral to the TLD servers; the resolver then continues down the hierarchy.', ['dns', 'application-layer']),

  // --- HTTP
  single(HTTP, 'MEDIUM', 'REMEMBER', 'Which of the following HTTP methods is NOT idempotent?',
    ['GET', 'PUT', 'DELETE', 'POST'],
    3, 'Repeating a POST can create a second resource. GET, PUT and DELETE have the same effect whether sent once or several times.', ['http', 'application-layer']),
  single(HTTP, 'HARD', 'APPLY', 'A web page consists of a base HTML file and 10 images on the same server. Ignoring transmission time, how many round-trip times are needed with non-persistent HTTP and no parallel connections?',
    ['11', '12', '20', '22'],
    3, 'Each of the 11 objects needs 1 RTT to open a TCP connection and 1 RTT for the request and response: 11 x 2 = 22 RTT.', ['http', 'application-layer']),

  // --- TLS and HTTPS
  single(TLS, 'MEDIUM', 'UNDERSTAND', 'In a TLS connection, what is used to encrypt the bulk of the application data?',
    ['The server\'s public key', 'The server\'s private key', 'Symmetric session keys derived during the handshake', 'The root key of the certificate authority'],
    2, 'Asymmetric cryptography is used only to authenticate the server and agree on keys; the data itself is protected with fast symmetric ciphers.', ['tls', 'security']),
  multi(TLS, 'HARD', 'ANALYZE', 'Which checks does a browser perform when it validates a server certificate? Select all that apply.',
    ['The chain of signatures leads to a trusted root CA', 'The current date lies within the validity period', 'The requested host name matches a name in the certificate', 'The certificate contains the server\'s private key'],
    [0, 1, 2], 'The browser checks the chain, the validity dates, the host name and revocation. A certificate contains only the public key; the private key never leaves the server.', ['tls', 'certificates', 'security']),
  subj(TLS, 'HARD', 'EVALUATE', 'Explain what forward secrecy means and how TLS 1.3 achieves it. Why did TLS 1.3 remove the RSA key exchange?',
    'Model answer. Forward secrecy: compromise of the server\'s long-term private key does not allow decryption of previously recorded sessions. TLS 1.3 achieves it by deriving session keys from an ephemeral Diffie-Hellman exchange; the ephemeral key shares are discarded after the handshake and the shared secret never crosses the network. With RSA key exchange the client encrypts the pre-master secret under the server\'s long-term public key, so anyone who records traffic and later obtains the private key can decrypt everything; it was removed for that reason. Award 2 marks for the definition, 2 for the mechanism and 1 for the RSA argument.',
    {
      good: 'Forward secrecy means that even if the server\'s private key is stolen in the future, traffic recorded earlier still cannot be decrypted. TLS 1.3 gets this by using ephemeral Diffie-Hellman: client and server each send a fresh key share, compute the same secret, derive the session keys from it and then throw the key shares away. The long-term key is used only to sign the handshake. With the old RSA key exchange the client encrypted the secret with the server\'s public key, so an attacker who saved the traffic and later got the private key could recover every session key. That is why TLS 1.3 removed it.',
      partial: 'Forward secrecy means old sessions stay safe if the key leaks later. TLS 1.3 uses Diffie-Hellman for this. RSA was removed because it is slower and less secure.',
      weak: 'Forward secrecy means the data is forwarded secretly to the server using encryption. TLS 1.3 is the newest version so it is more secure than RSA.',
    }, ['tls', 'forward-secrecy', 'security']),
];
