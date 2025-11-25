<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router';

const router = useRouter()
function goToTicketDetail(id) {
  router.push(`/ticket/${id}`)
}

function goToAddTicket() {
  router.push(`/ticket/add-ticket`)
}
onMounted(() => {
})
</script>

<template>
  <div>
    <div class="header max-w-full flex items-center h-[52px] p-2.5 text-[18px] font-bold text-white mx-4 mt-6 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500">Danh sách yêu cầu hỗ trợ</div>

    <div class="max-w-full mx-4 py-4 overflow-hidden">
      <!-- Card -->
      <div class="flex flex-col">
        <div class="-m-1.5 overflow-x-auto">
          <div class="p-1.5 min-w-full inline-block align-middle">
            <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden dark:bg-neutral-900 dark:border-neutral-700">
              <!-- Header -->
              <div class="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200 dark:border-neutral-700">
                <div>
                  <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                      <button id="hs-as-table-table-filter-dropdown" type="button" class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-2xs hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" aria-haspopup="menu" aria-expanded="false" aria-label="Dropdown">
                        Trạng thái
                        <svg class="shrink-0 size-3.5 text-white dark:text-neutral-200" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
                       <span class="absolute top-0 end-0 inline-flex items-center py-0.5 px-1.5 rounded-full text-xs font-medium transform -translate-y-1/2 translate-x-1/2 border border-white bg-blue-600 text-white">9</span>
                      </button>
                      <div class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden divide-y divide-gray-200 min-w-48 z-20 bg-white shadow-md rounded-lg mt-2 dark:divide-neutral-700 dark:bg-neutral-800 dark:border dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-as-table-table-filter-dropdown">
                        <div class="divide-y divide-gray-200 dark:divide-neutral-700">
                          <label for="hs-as-filters-dropdown-1" class="flex py-2.5 px-3">
                            <input type="checkbox" class="shrink-0 mt-0.5 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-600 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-800" id="hs-as-filters-dropdown-1" checked>
                            <span class="ms-3 text-sm text-gray-800 dark:text-neutral-200">Chờ tiếp nhận</span>
                          </label>
                          <label for="hs-as-filters-dropdown-2" class="flex py-2.5 px-3">
                            <input type="checkbox" class="shrink-0 mt-0.5 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-600 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-800" id="hs-as-filters-dropdown-2" checked>
                            <span class="ms-3 text-sm text-gray-800 dark:text-neutral-200">Chờ xử lý</span>
                          </label>
                           <label for="hs-as-filters-dropdown-3" class="flex py-2.5 px-3">
                            <input type="checkbox" class="shrink-0 mt-0.5 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-600 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-800" id="hs-as-filters-dropdown-3" checked>
                            <span class="ms-3 text-sm text-gray-800 dark:text-neutral-200">Đang xử lý</span>
                          </label>
                        </div>
                      </div>
                    </div>
                </div>

                <div>
                  <div class="inline-flex gap-x-4">
                    <div class="sm:col-span-1">
                      <label for="hs-as-table-product-review-search" class="sr-only">Search</label>
                      <div class="relative">
                        <input type="text" id="hs-as-table-product-review-search" name="hs-as-table-product-review-search" class="py-2 px-3 ps-11 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" placeholder="Tìm kiếm">
                        <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                          <svg class="size-4 text-gray-400 dark:text-neutral-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <button @click="goToAddTicket" type="button" class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-linear-to-r from-blue-600 to-blue-500  text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">
                      <svg class="shrink-0 size-4 group-hover:scale-115 group-focus:scale-115 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                      Tạo yêu cầu mới
                    </button>
                  </div>
                </div>
              </div>
              <!-- End Header -->

              <!-- Table -->
              <table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
                <thead class="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Mã yêu cầu
                      </a>
                    </th>

                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Tiêu đề
                      </a>
                    </th>

                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Người gửi
                      </a>
                    </th>

                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Cửa hàng
                      </a>
                    </th>

                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Phòng ban
                      </a>
                    </th>

                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Trạng thái
                      </a>
                    </th>

                    <th scope="col" class="px-6 py-3 text-start">
                      <a class="group inline-flex items-center gap-x-2 text-xs font-semibold uppercase text-gray-800 hover:text-gray-500 focus:outline-hidden focus:text-gray-500 dark:text-neutral-200 dark:hover:text-neutral-500 dark:focus:text-neutral-500" href="#">
                        Cập nhật
                      </a>
                    </th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-gray-200 dark:divide-neutral-700">
                  
                  <tr v-if="true" @click="goToTicketDetail('12345678')" class="bg-white hover:bg-gray-50 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                    <td class="size-px whitespace-nowrap">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2">
                          <div class="block text-sm text-blue-600 decoration-2 hover:underline dark:text-blue-500">#digitalmarketing</div>
                        </div>
                      </a>
                    </td>
                    <td class="h-px w-72 min-w-72">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2">
                          <p class="text-sm text-gray-500 dark:text-neutral-500">Our group promotes and sells products and services by leveraging online marketing tactics</p>
                        </div>
                      </a>
                    </td>
                    <td class="size-px whitespace-nowrap">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2">
                          <span class="inline-flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-800 dark:bg-neutral-900 dark:text-neutral-200">
                            Marketing team
                          </span>
                        </div>
                      </a>
                    </td>
                    <td class="size-px whitespace-nowrap">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2 flex gap-x-1">
                          aaaaaaaa
                        </div>
                      </a>
                    </td>
                    <td class="size-px whitespace-nowrap">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2 flex gap-x-1">
                          aaaaaaaa
                        </div>
                      </a>
                    </td>
                    <td class="size-px whitespace-nowrap">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2 flex gap-x-1">
                          aaaaaaaa
                        </div>
                      </a>
                    </td>
                    <td class="size-px whitespace-nowrap">
                      <a class="block relative z-10" href="#">
                        <div class="px-6 py-2 flex gap-x-1">
                          aaaaaaaa
                        </div>
                      </a>
                    </td>
                  </tr>
                   <tr v-else>
                    <td colspan="7" class="py-10">
                      <div class="flex flex-col items-center justify-center text-gray-500 dark:text-neutral-400">
                        <svg
                          class="w-10 h-10 mb-2 opacity-70"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round"
                                d="M3 7h18M3 12h12M3 17h18" />
                        </svg>
                        <p class="text-sm">Không có dữ liệu</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
                
              </table>
              <!-- End Table -->

              <!-- Footer -->
              <div class="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-t border-gray-200 dark:border-neutral-700">
                <div>
                  <p class="text-sm text-gray-600 dark:text-neutral-400">
                    Tổng <span class="font-semibold text-gray-800 dark:text-neutral-200">6</span>
                  </p>
                </div>

                <div>
                  <div class="inline-flex gap-x-2">
                    <button type="button" class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>

                    <button type="button" class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <!-- End Footer -->
            </div>
          </div>
        </div>
      </div>
      <!-- End Card -->
    </div>

  </div>
</template>

<style scoped>

</style>
