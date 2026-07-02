import os
import aiohttp
import asyncio
from PIL import Image
from io import BytesIO
from utils.logger import logger

class ImageProcessor:
    def __init__(self, temp_dir: str = "temp_images"):
        self.temp_dir = temp_dir
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir)

    async def download_image(self, session: aiohttp.ClientSession, url: str) -> Optional[bytes]:
        try:
            async with session.get(url, timeout=20) as response:
                if response.status == 200:
                    return await response.read()
        except Exception as e:
            logger.error(f"Failed to download image {url}: {e}")
        return None

    async def process_chapter(self, manga_title: str, chapter_name: str, image_urls: List[str], max_height: int = 1500) -> List[str]:
        output_dir = os.path.join(self.temp_dir, f"{manga_title}_{chapter_name}".replace(" ", "_"))
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        processed_paths = []
        async with aiohttp.ClientSession() as session:
            tasks = [self.download_image(session, url) for url in image_urls]
            image_data_list = await asyncio.gather(*tasks)

            for i, data in enumerate(image_data_list):
                if not data: continue
                
                try:
                    img = Image.open(BytesIO(data))
                    width, height = img.size
                    
                    if height <= max_height:
                        path = os.path.join(output_dir, f"page_{i:03d}.jpg")
                        img.convert('RGB').save(path, 'JPEG', quality=85)
                        processed_paths.append(path)
                    else:
                        # Slice long images for Facebook
                        num_parts = (height + max_height - 1) // max_height
                        for part in range(num_parts):
                            top = part * max_height
                            bottom = min((part + 1) * max_height, height)
                            
                            part_img = img.crop((0, top, width, bottom))
                            path = os.path.join(output_dir, f"page_{i:03d}_part_{part:02d}.jpg")
                            part_img.convert('RGB').save(path, 'JPEG', quality=85)
                            processed_paths.append(path)
                except Exception as e:
                    logger.error(f"Error processing image {i}: {e}")

        return processed_paths

    def cleanup(self, path: str):
        if os.path.isfile(path):
            os.remove(path)
        elif os.path.isdir(path):
            import shutil
            shutil.rmtree(path)
