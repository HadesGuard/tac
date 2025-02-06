import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import {HttpsProxyAgent} from 'https-proxy-agent';


// Hàm lấy proxy mới từ API của KiotProxy
async function getNewProxy(apiKey) {
  try {
    const response = await fetch(`https://api.kiotproxy.com/api/v1/proxies/new?key=${apiKey}`);
    const data = await response.json();
    if (data && data.success) {
      return data.data; // Giả sử dữ liệu trả về có cấu trúc: { host, httpPort, nextRequestAt, ... }
    } else {
      throw new Error("Failed to get new proxy");
    }
  } catch (error) {
    console.error(`Lỗi khi lấy proxy mới: ${error}`);
    return null;
  }
}

// Hàm kiểm tra proxy hiện tại từ API của KiotProxy
async function checkCurrentProxy(apiKey) {
  try {
    const response = await fetch(`https://api.kiotproxy.com/api/v1/proxies/current?key=${apiKey}`);
    const data = await response.json();
    if (data && data.success) {
      return data.data;
    } else if (data.error === "PROXY_NOT_FOUND_BY_KEY") {
      console.log("Proxy không tồn tại, lấy proxy mới...");
      return await getNewProxy(apiKey);
    } else {
      throw new Error("Failed to check current proxy");
    }
  } catch (error) {
    console.error(`Lỗi khi kiểm tra proxy hiện tại: ${error}`);
    return null;
  }
}

// Hàm claim faucet cho mỗi address: Mỗi address sẽ sử dụng 1 proxy mới (chỉ 1 lần faucet)
async function claimTokensForAddresses(apiKey, addresses) {
  for (const address of addresses) {
    try {
      // Kiểm tra proxy hiện tại và tính waitTime (giữ nguyên logic ban đầu)
      const currentProxyData = await checkCurrentProxy(apiKey);
      let waitTime = 0;
      if (currentProxyData && currentProxyData.nextRequestAt) {
        const currentTime = Date.now();
        const nextRequestAt = currentProxyData.nextRequestAt;
        waitTime = nextRequestAt - currentTime + Math.floor(Math.random() * 10000) + 3000;
        if (waitTime < 0) {
          waitTime = Math.floor(Math.random() * 10000) + 3000;
        }
      } else {
        waitTime = Math.floor(Math.random() * 60000) + 120000;
      }

      console.log(`Đợi ${waitTime / 1000} giây trước khi lấy proxy mới cho address ${address}...`);
      await new Promise((r) => setTimeout(r, waitTime));

      // Lấy proxy mới cho address hiện tại
      const proxyData = await getNewProxy(apiKey);
      if (!proxyData) {
        console.error(`Không lấy được proxy mới cho address ${address}, bỏ qua...`);
        continue;
      }

      const { host, httpPort } = proxyData;
      console.log(`Sử dụng proxy: http://${host}:${httpPort} cho address ${address}`);

      // Gửi request POST faucet qua proxy vừa lấy
      const agent = new HttpsProxyAgent(`http://${host}:${httpPort}`);
      const response = await fetch("https://faucet-backend.tac-turin.ankr.com/api/claim", {
        method: 'POST',
        headers: {
          "accept": "application/json",
          "accept-language": "en,vi-VN;q=0.9,vi;q=0.8,fr-FR;q=0.7,fr;q=0.6,en-US;q=0.5",
          "cache-control": "no-cache",
          "content-type": "application/json",
          "pragma": "no-cache",
          "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"macOS\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          "Referer": "https://turin.faucet.tac.build/",
          "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        body: JSON.stringify({ address }),
        agent,
        timeout: 60000
      });

      const responseData = await response.json();
      console.log(`Claim thành công cho ${address}:`, responseData);

      // Append address đã faucet vào file done.txt
      await fs.appendFile('done.txt', `${address}\n`, 'utf8');
      console.log(`Đã ghi ${address} vào file done.txt`);
    } catch (err) {
      console.error(`Lỗi khi claim cho ${address}:`, err.message);
      if (err.response) {
        console.error(`Lỗi khi claim cho ${address}: ${err.response.status} - ${err.response.statusText}`);
      } else {
        console.error(`Lỗi mạng hoặc khi xử lý ${address}: ${err.message}`);
      }
    }
  }
}

// Hàm main: Đọc API key, danh sách address, bỏ qua những ví đã faucet (done.txt),
// sau đó phân chia addresses cho từng API key và chạy claim
async function main() {
  try {
    // Đọc API key từ file api-key.txt
    const apiKeysContent = await fs.readFile('api-key.txt', 'utf8');
    const apiKeys = apiKeysContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Đọc danh sách addresses từ file addresses.txt
    const addressesContent = await fs.readFile('addresses.txt', 'utf8');
    let addresses = addressesContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Đọc file done.txt để lấy danh sách ví đã faucet (nếu file tồn tại)
    let doneAddresses = [];
    try {
      const doneContent = await fs.readFile('done.txt', 'utf8');
      doneAddresses = doneContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (err) {
      // Nếu file done.txt không tồn tại, coi như chưa có ví nào được faucet.
      console.log("Chưa có file done.txt, bắt đầu từ danh sách addresses ban đầu.");
    }

    // Lọc bỏ các address đã faucet
    const doneSet = new Set(doneAddresses);
    addresses = addresses.filter(address => !doneSet.has(address));

    console.log(`Tổng số ví cần faucet: ${addresses.length}`);

    if (addresses.length === 0) {
      console.log("Tất cả các ví đã được faucet. Kết thúc chương trình.");
      return;
    }

    // Chia danh sách addresses thành từng nhóm cho mỗi API key
    const chunkSize = Math.ceil(addresses.length / apiKeys.length);
    const addressGroups = [];
    for (let i = 0; i < addresses.length; i += chunkSize) {
      addressGroups.push(addresses.slice(i, i + chunkSize));
    }

    // Chạy claimTokensForAddresses cho từng API key (với nhóm addresses tương ứng)
    await Promise.all(apiKeys.map((apiKey, index) => {
      const group = addressGroups[index] || [];
      return claimTokensForAddresses(apiKey, group);
    }));

    console.log("Hoàn thành việc claim cho tất cả các API key.");
  } catch (err) {
    console.error("Lỗi khi đọc file:", err);
  }
}

// Bắt đầu chạy chương trình
main();